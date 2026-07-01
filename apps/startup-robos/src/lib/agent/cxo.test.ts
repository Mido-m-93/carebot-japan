import { describe, it, expect } from 'vitest'
import { CXO_SYSTEM_PROMPTS, type CXORole } from './cxo'

const ALL_ROLES: CXORole[] = ['ceo', 'cto', 'cmo', 'coo', 'cfo']

describe('CXO_SYSTEM_PROMPTS', () => {
  it('defines a non-empty string prompt for all 5 roles', () => {
    for (const role of ALL_ROLES) {
      expect(typeof CXO_SYSTEM_PROMPTS[role]).toBe('string')
      expect(CXO_SYSTEM_PROMPTS[role].length).toBeGreaterThan(0)
    }
  })

  it('CEO prompt contains DECISION keyword', () => {
    expect(CXO_SYSTEM_PROMPTS.ceo).toMatch(/DECISION/)
  })

  it('CTO prompt references technical concepts', () => {
    expect(CXO_SYSTEM_PROMPTS.cto).toMatch(/technical/i)
  })
})
