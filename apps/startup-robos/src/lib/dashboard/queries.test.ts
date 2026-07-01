vi.mock('server-only', () => ({}))
import { describe, it, expect } from 'vitest'
import { agentForTaskType, formatTaskType, formatModel, formatRelativeTime } from './queries'

describe('agentForTaskType', () => {
  it('returns the correct role for known task types', () => {
    expect(agentForTaskType('pivot_analysis')).toBe('ceo')
    expect(agentForTaskType('mvp_spec')).toBe('cto')
    expect(agentForTaskType('market_research')).toBe('cmo')
    expect(agentForTaskType('ops_review')).toBe('coo')
    expect(agentForTaskType('budget_review')).toBe('cfo')
  })

  it('defaults to ceo for null', () => {
    expect(agentForTaskType(null)).toBe('ceo')
  })

  it('defaults to ceo for unknown task type', () => {
    expect(agentForTaskType('unknown_task')).toBe('ceo')
  })
})

describe('formatTaskType', () => {
  it('returns the task label for known types', () => {
    expect(formatTaskType('pivot_analysis')).toBe('Pivot Analysis')
    expect(formatTaskType('mvp_spec')).toBe('MVP Specification')
  })

  it('returns "Unknown" for null', () => {
    expect(formatTaskType(null)).toBe('Unknown')
  })

  it('replaces underscores with spaces for unknown types', () => {
    expect(formatTaskType('some_new_task')).toBe('some new task')
  })
})

describe('formatModel', () => {
  it('returns short name for known model strings', () => {
    expect(formatModel('claude-opus-4-6')).toBe('Opus')
    expect(formatModel('claude-sonnet-4-6')).toBe('Sonnet')
    expect(formatModel('claude-haiku-4-5-20251001')).toBe('Haiku')
  })

  it('returns dash for null', () => {
    expect(formatModel(null)).toBe('—')
  })

  it('returns raw string for unknown model', () => {
    expect(formatModel('gpt-4')).toBe('gpt-4')
  })
})

describe('formatRelativeTime', () => {
  it('returns dash for null', () => {
    expect(formatRelativeTime(null)).toBe('—')
  })

  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString()
    expect(formatRelativeTime(now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })
})
