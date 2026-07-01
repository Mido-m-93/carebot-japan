import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// @supabase/ssr をモック
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@supabase/ssr'
import { getAuthUser } from './getAuthUser'

const mockCreateServerClient = vi.mocked(createServerClient)

function makeRequest(cookies: Record<string, string> = {}): NextRequest {
  const url = 'http://localhost/api/agent/run'
  const req = new NextRequest(url)
  Object.entries(cookies).forEach(([k, v]) => req.cookies.set(k, v))
  return req
}

describe('getAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('セッションがない場合 null を返す', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createServerClient>)

    const result = await getAuthUser(makeRequest())
    expect(result).toBeNull()
  })

  it('セッションがある場合 user.id を返す', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createServerClient>)

    const result = await getAuthUser(makeRequest())
    expect(result).toEqual({ id: 'user-123' })
  })
})
