import { describe, expect, it } from 'vitest'
import { effectiveTaskStatus, migrateLegacyAISettings, QWEN_API_BASE_URL, recurrenceMatches, type Settings, type Task } from './db'

describe('recurrenceMatches', () => {
  it('handles daily, weekly, weekdays and monthly rules', () => {
    expect(recurrenceMatches({ kind: 'daily' }, '2026-09-01', '2026-09-03')).toBe(true)
    expect(recurrenceMatches({ kind: 'weekly' }, '2026-09-01', '2026-09-08')).toBe(true)
    expect(recurrenceMatches({ kind: 'weekly' }, '2026-09-01', '2026-09-09')).toBe(false)
    expect(recurrenceMatches({ kind: 'weekdays' }, '2026-09-01', '2026-09-05')).toBe(false)
    expect(recurrenceMatches({ kind: 'monthly' }, '2026-09-03', '2026-10-03')).toBe(true)
  })

  it('honors start and until boundaries', () => {
    expect(recurrenceMatches({ kind: 'daily' }, '2026-09-03', '2026-09-02')).toBe(false)
    expect(recurrenceMatches({ kind: 'daily', until: '2026-09-05' }, '2026-09-03', '2026-09-06')).toBe(false)
  })
})

describe('effectiveTaskStatus', () => {
  const task = { id: '1', title: 'repeat', date: '2026-09-01', status: 'todo', recurrence: { kind: 'daily' }, occurrenceStatuses: { '2026-09-03': 'done' }, createdAt: '', updatedAt: '' } as Task
  it('keeps recurring occurrence states independent', () => {
    expect(effectiveTaskStatus(task, '2026-09-03')).toBe('done')
    expect(effectiveTaskStatus(task, '2026-09-04')).toBe('todo')
  })
})

describe('migrateLegacyAISettings', () => {
  it('moves the original OpenAI defaults to Qwen without forwarding the old key', () => {
    const legacy = { id: 'main', aiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-4o-mini', aiApiKey: 'old-secret', confidenceThreshold: 0.85, categories: [] } as Settings
    expect(migrateLegacyAISettings(legacy)).toMatchObject({ aiBaseUrl: QWEN_API_BASE_URL, aiModel: 'qwen-plus', aiApiKey: '' })
  })
})
