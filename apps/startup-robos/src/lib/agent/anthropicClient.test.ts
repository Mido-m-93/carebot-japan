vi.mock('server-only', () => ({}))
import { describe, it, expect } from 'vitest'
import { anthropic } from './anthropicClient'

describe('anthropicClient singleton', () => {
  it('exports an Anthropic instance', () => {
    expect(typeof anthropic).toBe('object')
    expect(anthropic).not.toBeNull()
  })

  it('has a messages property', () => {
    expect(anthropic.messages).toBeDefined()
  })

  it('returns the same instance on repeated imports', async () => {
    const { anthropic: second } = await import('./anthropicClient')
    expect(second).toBe(anthropic)
  })
})
