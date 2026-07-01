vi.mock('server-only', () => ({}))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireCronAuth: vi.fn(() => null),
}))
vi.mock('@/lib/agent/heartbeatRunner', () => ({
  runHeartbeatTask: vi.fn().mockResolvedValue({ content: 'CXO suggestions', costUsd: 0.02 }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: 's1', name: 'AI Tool Lab', business_type: 'affiliate_seo' },
            { id: 's2', name: 'Prompt Pack', business_type: 'digital_product' },
            { id: 's3', name: 'Puzzle Games', business_type: 'game_ads' },
          ],
          error: null,
        }),
      })),
    })),
  })),
}))

import { GET } from './route'
import { requireCronAuth } from '@/lib/auth'
import { runHeartbeatTask } from '@/lib/agent/heartbeatRunner'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/heartbeat/cxo')
}

describe('GET /api/heartbeat/cxo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok with results for all CXO tasks', async () => {
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.results).toHaveLength(5) // 3 business + 2 cross-functional
    expect(json.total_cost_usd).toBe(0.1) // 5 * 0.02
  })

  it('calls runHeartbeatTask 5 times (3 business + 2 cross-functional)', async () => {
    await GET(makeRequest())
    expect(runHeartbeatTask).toHaveBeenCalledTimes(5)
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
