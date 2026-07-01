import { describe, it, expect } from 'vitest'
import { TASK_AGENT } from './roles'

const EXPECTED_KEYS = [
  'pivot_analysis',
  'mvp_spec',
  'market_research',
  'ops_review',
  'budget_review',
  'pivot_decision',
  'ceo_review',
  'cto_review',
]

describe('TASK_AGENT', () => {
  it('contains all 8 task types', () => {
    expect(Object.keys(TASK_AGENT)).toEqual(expect.arrayContaining(EXPECTED_KEYS))
    expect(Object.keys(TASK_AGENT)).toHaveLength(8)
  })

  it.each(EXPECTED_KEYS)('%s has label, color, role, and taskLabel', (key) => {
    const def = TASK_AGENT[key]
    expect(def.label).toEqual(expect.any(String))
    expect(def.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(def.role).toEqual(expect.any(String))
    expect(def.taskLabel).toEqual(expect.any(String))
  })

  it('all role values are lowercase', () => {
    for (const def of Object.values(TASK_AGENT)) {
      expect(def.role).toBe(def.role.toLowerCase())
    }
  })
})
