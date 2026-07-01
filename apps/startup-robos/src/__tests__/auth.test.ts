import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requireApiAuth, requireCronAuth } from '@/lib/auth'

// Minimal mock of NextRequest
function mockRequest(headers: Record<string, string> = {}): Parameters<typeof requireApiAuth>[0] {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('requireApiAuth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 500 when API_SECRET is not configured', async () => {
    delete process.env.API_SECRET
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = requireApiAuth(mockRequest({ 'x-api-secret': 'anything' }))
    expect(result).not.toBeNull()
    const body = await result!.json()
    expect(result!.status).toBe(500)
    expect(body.error).toContain('misconfigured')
    consoleSpy.mockRestore()
  })

  it('returns 401 when no header is provided', async () => {
    process.env.API_SECRET = 'test-secret'
    const result = requireApiAuth(mockRequest())
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns 401 when header value is wrong', async () => {
    process.env.API_SECRET = 'test-secret'
    const result = requireApiAuth(mockRequest({ 'x-api-secret': 'wrong' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns null (pass) when header matches', () => {
    process.env.API_SECRET = 'test-secret'
    const result = requireApiAuth(mockRequest({ 'x-api-secret': 'test-secret' }))
    expect(result).toBeNull()
  })
})

describe('requireCronAuth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = requireCronAuth(mockRequest({ authorization: 'Bearer whatever' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(500)
    consoleSpy.mockRestore()
  })

  it('returns 401 when bearer token is wrong', async () => {
    process.env.CRON_SECRET = 'cron-test'
    const result = requireCronAuth(mockRequest({ authorization: 'Bearer wrong' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns null (pass) when bearer matches', () => {
    process.env.CRON_SECRET = 'cron-test'
    const result = requireCronAuth(mockRequest({ authorization: 'Bearer cron-test' }))
    expect(result).toBeNull()
  })
})
