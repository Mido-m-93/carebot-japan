import { describe, it, expect } from 'vitest'
import { GOLDEN_TASKS } from './goldenTasks'
import { RESPONSE_SCHEMAS, type TaskType } from '@/lib/agent/responseSchemas'

describe('GOLDEN_TASKS', () => {
  it('8 タスクが定義されている', () => {
    expect(GOLDEN_TASKS).toHaveLength(8)
  })

  it('全タスクの taskType が RESPONSE_SCHEMAS に存在する', () => {
    for (const task of GOLDEN_TASKS) {
      expect(RESPONSE_SCHEMAS[task.taskType as TaskType]).toBeDefined()
    }
  })

  it('全タスクに id / system / prompt / maxTokens がある', () => {
    for (const task of GOLDEN_TASKS) {
      expect(task.id).toBeTruthy()
      expect(task.system).toBeTruthy()
      expect(task.prompt).toBeTruthy()
      expect(task.maxTokens).toBeGreaterThan(0)
    }
  })

  it('id がユニーク', () => {
    const ids = GOLDEN_TASKS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('high tier と low tier の両方がある', () => {
    const tiers = new Set(GOLDEN_TASKS.map(t => t.tier))
    expect(tiers.has('high')).toBe(true)
    expect(tiers.has('low')).toBe(true)
  })
})
