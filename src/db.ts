import Dexie, { type Table } from 'dexie'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type RecurrenceKind = 'daily' | 'weekdays' | 'weekly' | 'monthly'
export type RecurrenceRule = { kind: RecurrenceKind; until?: string }

export interface Task {
  id: string; title: string; status: TaskStatus; date: string; note?: string
  recurrence?: RecurrenceRule; completedAt?: string; occurrenceStatuses?: Record<string, TaskStatus>
  occurrenceCompletedAt?: Record<string, string>; createdAt: string; updatedAt: string
}
export interface Idea { id: string; date: string; content: string; tags: string[]; createdAt: string; updatedAt: string }
export interface Expense {
  id: string; date: string; amountCny: number; category: string; note?: string
  merchant?: string; paymentMethod?: string; source: 'manual' | 'ai'; aiConfidence?: number; balanceId?: string; createdAt: string
}
export interface Budget { id: string; month: string; category: string; limitCny: number; startDate?: string }
export interface Balance { id: string; name: string; amountCny: number; location: string; note?: string; createdAt: string; updatedAt: string }
export interface Settings { id: 'main'; aiBaseUrl: string; aiModel: string; aiApiKey: string; confidenceThreshold: number; categories: string[] }
export interface ApiKey { id: string; name: string; service: string; key: string; note?: string; createdAt: string; updatedAt: string }
export type TimeEventType = 'reward' | 'study'
export interface TimeRule { id: string; title: string; description: string; buttonLabel: string; minutesPerClick: number; icon: string; color: string; sortOrder: number; enabled: boolean; createdAt: string; updatedAt: string }
export interface TimeEvent { id: string; date: string; ruleId: string; ruleTitleSnapshot: string; type: TimeEventType; minutes: number; count: number; createdAt: string; updatedAt: string }
export interface SyncChange { id?: number; collection: SyncCollection; recordId: string; updatedAt: string; deleted?: boolean }
export type SyncCollection = 'tasks' | 'ideas' | 'expenses' | 'budgets' | 'balances' | 'timeRules' | 'timeEvents'

class DaybookDB extends Dexie {
  tasks!: Table<Task, string>; ideas!: Table<Idea, string>; expenses!: Table<Expense, string>
  budgets!: Table<Budget, string>; balances!: Table<Balance, string>; settings!: Table<Settings, string>; apiKeys!: Table<ApiKey, string>; syncChanges!: Table<SyncChange, number>
  timeRules!: Table<TimeRule, string>; timeEvents!: Table<TimeEvent, string>
  constructor() {
    super('quiet-daybook')
    this.version(1).stores({ tasks: 'id,date,status', ideas: 'id,date', expenses: 'id,date,category', budgets: 'id,month,category', settings: 'id' })
    this.version(2).stores({ balances: 'id,location' })
    this.version(3).stores({ apiKeys: 'id,service' })
    this.version(4).stores({ syncChanges: '++id,collection,recordId,updatedAt' })
    this.version(5).stores({ timeRules: 'id,sortOrder,enabled', timeEvents: 'id,date,type,ruleId,updatedAt' })
  }
}

export const db = new DaybookDB()
const remoteTransactions = new WeakSet<object>()
const immediateSyncChanges = new Map<string, SyncChange>()
const changeKey = (change: SyncChange) => `${change.collection}:${change.recordId}`
const rememberSyncChange = (change: SyncChange) => {
  immediateSyncChanges.set(changeKey(change), change)
  // Keep a durable outbox for reload/offline recovery. The in-memory copy is
  // synchronous so a save followed immediately by sync cannot miss it.
  void db.syncChanges.add(change).catch((error) => console.warn('failed to queue sync change', error))
}
export const getImmediateSyncChanges = () => [...immediateSyncChanges.values()]
export const forgetImmediateSyncChanges = (changes: SyncChange[]) => {
  for (const change of changes) {
    const key = changeKey(change)
    if (immediateSyncChanges.get(key)?.updatedAt === change.updatedAt)
      immediateSyncChanges.delete(key)
  }
}
export async function putFromSync(collection: SyncCollection, value: any) {
  const table = (db as any)[collection] as Table<any, string>
  await db.transaction('rw', table, async () => {
    if (Dexie.currentTransaction) remoteTransactions.add(Dexie.currentTransaction)
    await table.put(value)
  })
}
export async function deleteFromSync(collection: SyncCollection, id: string) {
  const table = (db as any)[collection] as Table<any, string>
  await db.transaction('rw', table, async () => {
    if (Dexie.currentTransaction) remoteTransactions.add(Dexie.currentTransaction)
    await table.delete(id)
  })
}

// Capture local mutations so deletes can be propagated to other devices.
const syncTables: Array<[SyncCollection, Table<any, string>]> = [
  ['tasks', db.tasks], ['ideas', db.ideas], ['expenses', db.expenses], ['budgets', db.budgets], ['balances', db.balances], ['timeRules', db.timeRules], ['timeEvents', db.timeEvents],
]
for (const [collection, table] of syncTables) {
  table.hook('creating', (_key, obj, transaction) => { if (!remoteTransactions.has(transaction)) rememberSyncChange({ collection, recordId: obj.id, updatedAt: obj.updatedAt ?? new Date().toISOString() }) })
  table.hook('updating', (changes, _key, obj, transaction) => { if (!remoteTransactions.has(transaction)) rememberSyncChange({ collection, recordId: obj.id, updatedAt: String((changes as any).updatedAt ?? new Date().toISOString()) }) })
  table.hook('deleting', (key, _obj, transaction) => { if (!remoteTransactions.has(transaction)) rememberSyncChange({ collection, recordId: String(key), updatedAt: new Date().toISOString(), deleted: true }) })
}
export const uid = () => crypto.randomUUID()
export const localISODate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const todayISO = () => localISODate()
export const QWEN_API_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const QWEN_DEFAULT_MODEL = 'qwen-plus'
export const defaultSettings: Settings = { id: 'main', aiBaseUrl: QWEN_API_BASE_URL, aiModel: QWEN_DEFAULT_MODEL, aiApiKey: '', confidenceThreshold: 0.85, categories: ['餐饮', '交通', '购物', '居住', '娱乐', '学习', '医疗', '其他'] }

export function migrateLegacyAISettings(settings: Settings): Settings {
  if (settings.aiBaseUrl.replace(/\/$/, '') === 'https://api.openai.com/v1' && settings.aiModel === 'gpt-4o-mini') {
    return { ...settings, aiBaseUrl: QWEN_API_BASE_URL, aiModel: QWEN_DEFAULT_MODEL, aiApiKey: '' }
  }
  return settings
}

export function effectiveTaskStatus(task: Task, date: string): TaskStatus {
  return task.recurrence ? (task.occurrenceStatuses?.[date] ?? 'todo') : task.status
}

export function recurrenceMatches(rule: RecurrenceRule | undefined, start: string, target: string) {
  if (!rule || target < start || (rule.until && target > rule.until)) return false
  const s = new Date(`${start}T12:00:00`), t = new Date(`${target}T12:00:00`)
  const days = Math.round((t.getTime() - s.getTime()) / 86400000)
  if (rule.kind === 'daily') return true
  if (rule.kind === 'weekdays') return t.getDay() !== 0 && t.getDay() !== 6
  if (rule.kind === 'weekly') return days % 7 === 0
  return s.getDate() === t.getDate()
}

export async function tasksForDate(date: string) {
  const all = await db.tasks.toArray()
  return all.filter((task) => task.date === date || recurrenceMatches(task.recurrence, task.date, date))
}
