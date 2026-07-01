vi.mock('server-only', () => ({}))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireCronAuth: vi.fn(() => null),
}))
vi.mock('@/lib/notify', () => ({
  sendReport: vi.fn(),
}))
vi.mock('@/lib/agent/heartbeatRunner', () => ({
  runHeartbeatTask: vi.fn().mockResolvedValue({ content: 'CEO analysis', costUsd: 0.05 }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'startups') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 's1', name: 'Biz1', business_type: 'affiliate_seo', status: 'active' }],
              error: null,
            }),
          })),
        }
      }
      // experiments
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      }
    }),
  })),
}))

import { GET } from './route'
import { requireCronAuth } from '@/lib/auth'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/heartbeat/ceo')
}

describe('GET /api/heartbeat/ceo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok with assessment on success', async () => {
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.assessment).toBe('CEO analysis')
    expect(json.cost_usd).toBe(0.05)
  })

  it('returns auth error when requireCronAuth rejects', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(requireCronAuth).mockReturnValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns "No startups found" when no active startups', async () => {
    const { createServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(createServiceClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json.message).toBe('No startups found')
  })
})
