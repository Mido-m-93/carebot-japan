vi.mock('server-only', () => ({}))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

/* ---------- mocks ---------- */

const mockStartupsOrder = vi.fn()
const mockStartupsEq = vi.fn(() => ({ order: mockStartupsOrder }))
const mockStartupsSelect = vi.fn(() => ({ eq: mockStartupsEq }))

const mockExperimentsOrder = vi.fn()
const mockExperimentsIn = vi.fn(() => ({ order: mockExperimentsOrder }))
const mockExperimentsSelect = vi.fn(() => ({ in: mockExperimentsIn }))

const mockRunsLimit = vi.fn()
const mockRunsOrder = vi.fn(() => ({ limit: mockRunsLimit }))
const mockRunsEq = vi.fn(() => ({ order: mockRunsOrder }))
const mockRunsSelect = vi.fn(() => ({ eq: mockRunsEq }))

const mockBudgetSingle = vi.fn()
const mockBudgetEq = vi.fn(() => ({ single: mockBudgetSingle }))
const mockBudgetSelect = vi.fn(() => ({ eq: mockBudgetEq }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'startups') return { select: mockStartupsSelect }
      if (table === 'experiments') return { select: mockExperimentsSelect }
      if (table === 'agent_runs') return { select: mockRunsSelect }
      if (table === 'token_budgets') return { select: mockBudgetSelect }
      return {}
    }),
  })),
}))

const mockRequireApiAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  requireApiAuth: (...args: unknown[]) => mockRequireApiAuth(...args),
}))

import { GET } from './route'

/* ---------- helpers ---------- */

function makeRequest(
  headers: Record<string, string | null> = {}
): NextRequest {
  const defaultHeaders: Record<string, string | null> = {
    'x-user-id': 'user-123',
    'x-api-secret': 'test-secret',
    ...headers,
  }
  return {
    headers: { get: (key: string) => defaultHeaders[key] ?? null },
  } as unknown as NextRequest
}

function setupDefaultMocks(startups: unknown[] = []) {
  mockStartupsOrder.mockResolvedValueOnce({ data: startups, error: null })

  mockExperimentsOrder.mockResolvedValueOnce({ data: [], error: null })
  mockRunsLimit.mockResolvedValueOnce({ data: [], error: null })
  mockBudgetSingle.mockResolvedValueOnce({ data: null, error: null })
}

/* ---------- tests ---------- */

describe('GET /api/dashboard/data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireApiAuth.mockReturnValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireApiAuth.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const res = await GET(makeRequest({ 'x-api-secret': null }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when x-user-id header is missing', async () => {
    const res = await GET(makeRequest({ 'x-user-id': null }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 200 with startups, experiments, recentRuns, budget for user', async () => {
    const startups = [
      { id: 'startup-1', name: 'Biz A', status: 'active', business_type: 'affiliate_seo', experiment_count: 2, pivot_count: 0, created_at: '2026-01-01' },
    ]
    const experiments = [
      { id: 'exp-1', startup_id: 'startup-1', hypothesis: 'H1', metric: 'CTR', target_value: 0.05, status: 'running', result: null, started_at: '2026-01-02', completed_at: null },
    ]
    const runs = [
      { id: 'run-1', startup_id: 'startup-1', model: 'sonnet', task_type: 'seo_article', cost_usd: 0.05, created_at: '2026-01-03' },
    ]
    const budget = { user_id: 'user-123', monthly_budget_usd: 500, used_usd: 42 }

    mockStartupsOrder.mockResolvedValueOnce({ data: startups, error: null })
    mockExperimentsOrder.mockResolvedValueOnce({ data: experiments, error: null })
    mockRunsLimit.mockResolvedValueOnce({ data: runs, error: null })
    mockBudgetSingle.mockResolvedValueOnce({ data: budget, error: null })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.startups).toEqual(startups)
    expect(json.experiments).toEqual(experiments)
    expect(json.recentRuns).toEqual(runs)
    expect(json.budget).toEqual(budget)
  })

  it('returns 200 with empty arrays when user has no startups', async () => {
    setupDefaultMocks([])

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.startups).toEqual([])
    expect(json.experiments).toEqual([])
    expect(json.recentRuns).toEqual([])
    expect(json.budget).toBeNull()
  })
})
