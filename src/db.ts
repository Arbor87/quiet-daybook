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
  merchant?: string; paymentMethod?: string; source: 'manual' | 'ai'; aiConfidence?: number; createdAt: string
}
export interface Budget { id: string; month: string; category: string; limitCny: number }
export interface Settings { id: 'main'; aiBaseUrl: string; aiModel: string; aiApiKey: string; confidenceThreshold: number; categories: string[] }

class DaybookDB extends Dexie {
  tasks!: Table<Task, string>; ideas!: Table<Idea, string>; expenses!: Table<Expense, string>
  budgets!: Table<Budget, string>; settings!: Table<Settings, string>
  constructor() {
    super('quiet-daybook')
    this.version(1).stores({ tasks: 'id,date,status', ideas: 'id,date', expenses: 'id,date,category', budgets: 'id,month,category', settings: 'id' })
  }
}

export const db = new DaybookDB()
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
