import {
  db,
  deleteFromSync,
  forgetImmediateSyncChanges,
  getImmediateSyncChanges,
  putFromSync,
  type SyncChange,
  type SyncCollection,
} from './db'
import { supabase } from './supabase'

// These tables already exist in the deployed Supabase project. Keep optional
// modules out until their schema migration has actually been deployed, or one
// missing table would abort synchronization for every other module.
const collections: SyncCollection[] = ['tasks', 'ideas', 'expenses', 'budgets', 'balances']
const tableFor = (c: SyncCollection) => (db as any)[c]

export type SyncResult = 'synced' | 'pending' | 'error'

let syncInFlight: Promise<SyncResult> | null = null

export function syncUser(userId: string): Promise<SyncResult> {
  const previous = syncInFlight ?? Promise.resolve<SyncResult>('synced')
  const run = previous.then(() => syncUserInternal(userId))
  syncInFlight = run
  void run.finally(() => {
    if (syncInFlight === run) syncInFlight = null
  })
  return run
}

const newestChanges = (changes: SyncChange[]) => {
  const result = new Map<string, SyncChange>()
  for (const change of changes) {
    const key = `${change.collection}:${change.recordId}`
    const previous = result.get(key)
    if (!previous || change.updatedAt >= previous.updatedAt) result.set(key, change)
  }
  return [...result.values()]
}

async function syncUserInternal(userId: string): Promise<SyncResult> {
  try {
    const durableChanges = await db.syncChanges.orderBy('id').toArray()
    // Hooks write this memory outbox synchronously, so a delete followed
    // immediately by sync can never be mistaken for a missing local record.
    const changes = newestChanges([...durableChanges, ...getImmediateSyncChanges()])

    for (const collection of collections) {
      const table = tableFor(collection)
      const collectionChanges = changes.filter((c) => c.collection === collection)
      const deletedIds = new Set(collectionChanges.filter((c) => c.deleted).map((c) => c.recordId))
      const changedIds = new Set(collectionChanges.filter((c) => !c.deleted).map((c) => c.recordId))

      for (const change of collectionChanges) {
        if (!change.deleted) continue
        const { error } = await supabase.from(collection).upsert({
          user_id: userId,
          id: change.recordId,
          payload: {},
          updated_at: change.updatedAt,
          deleted_at: change.updatedAt,
        }, { onConflict: 'user_id,id' })
        if (error) throw error
      }

      const local = await table.toArray()
      const { data: remote, error } = await supabase.from(collection).select('*').eq('user_id', userId)
      if (error) throw error
      const remoteById = new Map((remote ?? []).map((row: any) => [row.id, row]))

      for (const snapshot of local) {
        if (deletedIds.has(snapshot.id)) continue
        const current = await table.get(snapshot.id)
        if (!current) continue
        const server: any = remoteById.get(current.id)
        // An explicit unsent local edit is newer by definition, even if two
        // devices have slightly different clocks.
        if (changedIds.has(current.id) || !server || new Date(current.updatedAt ?? 0) >= new Date(server.updated_at ?? 0)) {
          const updatedAt = current.updatedAt ?? new Date().toISOString()
          const { error: upsertError } = await supabase.from(collection).upsert({
            user_id: userId,
            id: current.id,
            payload: current,
            updated_at: updatedAt,
            deleted_at: null,
          }, { onConflict: 'user_id,id' })
          if (upsertError) throw upsertError
        } else if (!server.deleted_at) {
          await putFromSync(collection, server.payload)
        }
      }

      for (const server of remote ?? []) {
        if (deletedIds.has(server.id)) continue
        const current = await table.get(server.id)
        if (server.deleted_at) {
          if (!current || new Date(server.updated_at) >= new Date(current.updatedAt ?? 0))
            await deleteFromSync(collection, server.id)
        } else if (!current) {
          await putFromSync(collection, server.payload)
        }
      }
    }

    for (const change of durableChanges) if (change.id) await db.syncChanges.delete(change.id)
    forgetImmediateSyncChanges(changes)
    return 'synced'
  } catch (error) {
    console.warn('sync failed', error)
    return 'error'
  }
}
