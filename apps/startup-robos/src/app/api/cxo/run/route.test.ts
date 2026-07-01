vi.mock('server-only', () => ({}))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { BudgetExhaustedError } from '@/lib/agent/budgetDeduction'

vi.mock('@/lib/agent/council', () => ({
  runCouncil: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              user_id: 'user-123',
              name: 'TestCo',
              description: 'A test company',
              status: 'active',
              pivot_count: 0,
            },
            error: null,
          }),
        })),
      })),
    })),
  })),
}))
vi.mock('@/lib/security/piiMasker', () => ({
  maskPII: vi.fn((s: string) => s),
}))
vi.mock('@/lib/rateLimit', () => ({
  makeRateLimiter: () => async () => true,
}))
vi.mock('@/lib/startup/config', () => ({
  MAX_PIVOTS: 3,
}))
vi.mock('@/lib/auth', () => ({
  requireApiAuth: () => null,
}))

import { POST } from './route'
import { runCouncil } from '@/lib/agent/council'

const STARTUP_ID = '550e8400-e29b-41d4-a716-446655440000'

const VALID_BODY = {
  startupId: STARTUP_ID,
  agenda: 'Discuss Q2 growth strategy and expansion plans',
}

function makeRequest(body: object, userId = 'user-123'): NextRequest {
  return {
    headers: { get: (key: string) => (key === 'x-user-id' ? userId : null) },
    json: async () => body,
  } as unknown as NextRequest
}

describe('POST /api/cxo/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 402 when runCouncil throws BudgetExhaustedError', async () => {
    vi.mocked(runCouncil).mockRejectedValueOnce(
      new BudgetExhaustedError('Token budget exhausted')
    )

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error).toBe('Token budget exhausted')
  })

  it('returns 500 when runCouncil throws a plain Error', async () => {
    vi.mocked(runCouncil).mockRejectedValueOnce(new Error('Unexpected DB failure'))

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('An error occurred during the CXO meeting')
  })
})
