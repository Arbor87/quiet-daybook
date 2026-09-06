import { db, setSyncCaptureEnabled, type SyncCollection } from './db'
import { supabase } from './supabase'

const collections: SyncCollection[] = ['tasks', 'ideas', 'expenses', 'budgets', 'balances']
const tableFor = (c: SyncCollection) => (db as any)[c]

export type SyncResult = 'synced' | 'pending' | 'error'

export async function syncUser(userId: string): Promise<SyncResult> {
  try {
    setSyncCaptureEnabled(false)
    const changes = await db.syncChanges.orderBy('id').toArray()
    for (const collection of collections) {
      const table = tableFor(collection)
      const collectionChanges = changes.filter((c) => c.collection === collection)
      for (const change of collectionChanges) {
        if (change.deleted) {
          const { error } = await supabase.from(collection).upsert({ user_id: userId, id: change.recordId, payload: {}, updated_at: change.updatedAt, deleted_at: change.updatedAt }, { onConflict: 'user_id,id' })
          if (error) throw error
        }
      }
      const local = await table.toArray()
      const { data: remote, error } = await supabase.from(collection).select('*').eq('user_id', userId)
      if (error) throw error
      const remoteById = new Map((remote ?? []).map((row: any) => [row.id, row]))
      for (const item of local) {
        const server = remoteById.get(item.id)
        if (!server || new Date(item.updatedAt ?? 0) >= new Date(server.updated_at ?? 0)) {
          const { error: upsertError } = await supabase.from(collection).upsert({ user_id: userId, id: item.id, payload: item, updated_at: item.updatedAt ?? new Date().toISOString(), deleted_at: null }, { onConflict: 'user_id,id' })
          if (upsertError) throw upsertError
        } else await table.put(server.payload)
      }
      for (const server of remote ?? []) {
        const current = local.find((item: any) => item.id === server.id)
        if (server.deleted_at && (!current || new Date(server.updated_at) >= new Date(current.updatedAt ?? 0))) await table.delete(server.id)
        else if (!server.deleted_at && !current) await table.put(server.payload)
      }
    }
    for (const change of changes) if (change.id) await db.syncChanges.delete(change.id)
    return (await db.syncChanges.count()) ? 'pending' : 'synced'
  } catch (error) {
    console.warn('sync failed', error)
    return 'error'
  } finally { setSyncCaptureEnabled(true) }
}
