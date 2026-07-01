vi.mock('server-only', () => ({}))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

/* ---------- mocks ---------- */

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockInsert = vi.fn()
const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'startups') return { select: mockSelect, update: mockUpdate }
      if (table === 'pivot_log') return { insert: mockInsert }
      return {}
    }),
  })),
}))
vi.mock('@/lib/security/piiMasker', () => ({
  maskPII: vi.fn((s: string) => s),
}))
vi.mock('@/lib/startup/config', () => ({
  MAX_PIVOTS: 3,
}))

const mockRequireApiAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  requireApiAuth: (...args: unknown[]) => mockRequireApiAuth(...args),
}))

import { POST } from './route'

/* ---------- helpers ---------- */

const STARTUP_ID = '550e8400-e29b-41d4-a716-446655440000'

const VALID_BODY = {
  startupId: STARTUP_ID,
  agentSuggestion: 'Pivot to B2B SaaS model',
  pivotFrom: 'B2C marketplace',
  pivotTo: 'B2B SaaS',
  reason: 'Higher LTV',
}

function makeRequest(
  body: object,
  headers: Record<string, string | null> = {}
): NextRequest {
  const defaultHeaders: Record<string, string | null> = {
    'x-user-id': 'user-123',
    'x-api-secret': 'test-secret',
    ...headers,
  }
  return {
    headers: { get: (key: string) => defaultHeaders[key] ?? null },
    json: async () => body,
  } as unknown as NextRequest
}

/* ---------- tests ---------- */

describe('POST /api/pivot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireApiAuth.mockReturnValue(null) // auth passes by default
  })

  it('returns 401 when x-api-secret header is missing', async () => {
    mockRequireApiAuth.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const res = await POST(makeRequest(VALID_BODY, { 'x-api-secret': null }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when x-user-id header is missing', async () => {
    const res = await POST(makeRequest(VALID_BODY, { 'x-user-id': null }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when body is invalid (missing startupId)', async () => {
    const res = await POST(makeRequest({ agentSuggestion: 'test' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid input values')
  })

  it('returns 404 when startup not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Startup not found')
  })

  it('returns 403 when startup belongs to different user', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { user_id: 'other-user', pivot_count: 0 },
      error: null,
    })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 403 when pivot_count >= MAX_PIVOTS (3)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { user_id: 'user-123', pivot_count: 3 },
      error: null,
    })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Pivot limit reached')
  })

  it('returns 200 on success (inserts pivot_log + updates startup status)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { user_id: 'user-123', pivot_count: 1 },
      error: null,
    })
    mockInsert.mockResolvedValueOnce({ error: null })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    // Verify insert was called with correct data
    expect(mockInsert).toHaveBeenCalledWith({
      startup_id: STARTUP_ID,
      pivot_from: 'B2C marketplace',
      pivot_to: 'B2B SaaS',
      reason: 'Higher LTV',
      agent_suggestion: 'Pivot to B2B SaaS model',
    })

    // Verify update was called with incremented pivot_count and 'pivoted' status
    expect(mockUpdate).toHaveBeenCalledWith({ pivot_count: 2, status: 'pivoted' })
  })

  it('returns 500 when pivot_log insert fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { user_id: 'user-123', pivot_count: 0 },
      error: null,
    })
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to record pivot')
  })
})
