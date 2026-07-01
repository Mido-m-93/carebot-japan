import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock getAuthUser before importing middleware
vi.mock('@/lib/auth/getAuthUser', () => ({
  getAuthUser: vi.fn(),
}))

import { middleware, config } from './middleware'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { NextRequest } from 'next/server'

const mockedGetAuthUser = vi.mocked(getAuthUser)

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'))
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 JSON when user is not authenticated', async () => {
    mockedGetAuthUser.mockResolvedValue(null)
    const res = await middleware(makeRequest('/api/agent/run'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('passes through with x-user-id header when authenticated', async () => {
    mockedGetAuthUser.mockResolvedValue({ id: 'user-123' })
    const res = await middleware(makeRequest('/api/agent/run'))
    // NextResponse.next() returns 200
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-request-x-user-id')).toBe('user-123')
  })
})

describe('middleware config', () => {
  it('matches expected API routes', () => {
    expect(config.matcher).toContain('/api/agent/:path*')
    expect(config.matcher).toContain('/api/cxo/:path*')
    expect(config.matcher).toContain('/api/pivot')
    expect(config.matcher).toContain('/api/dashboard/:path*')
  })

  it('does not match heartbeat routes', () => {
    expect(config.matcher).not.toContain('/api/heartbeat/:path*')
  })
})
