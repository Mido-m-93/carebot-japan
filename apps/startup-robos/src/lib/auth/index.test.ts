import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireApiAuth, requireCronAuth } from './index'

function makeReq(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name] ?? null
      },
    },
  }
}

describe('requireApiAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when x-api-secret matches API_SECRET', () => {
    vi.stubEnv('API_SECRET', 'test-secret')
    const result = requireApiAuth(makeReq({ 'x-api-secret': 'test-secret' }))
    expect(result).toBeNull()
  })

  it('returns 500 when API_SECRET is not configured', () => {
    vi.stubEnv('API_SECRET', '')
    const result = requireApiAuth(makeReq({ 'x-api-secret': 'anything' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(500)
  })

  it('returns 401 when x-api-secret is missing', () => {
    vi.stubEnv('API_SECRET', 'test-secret')
    const result = requireApiAuth(makeReq({}))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns 401 when x-api-secret does not match', () => {
    vi.stubEnv('API_SECRET', 'test-secret')
    const result = requireApiAuth(makeReq({ 'x-api-secret': 'wrong' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })
})

describe('requireCronAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when Bearer token matches CRON_SECRET', () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const result = requireCronAuth(makeReq({ authorization: 'Bearer cron-secret' }))
    expect(result).toBeNull()
  })

  it('returns 500 when CRON_SECRET is not configured', () => {
    vi.stubEnv('CRON_SECRET', '')
    const result = requireCronAuth(makeReq({ authorization: 'Bearer anything' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(500)
  })

  it('returns 401 when authorization header is missing', () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const result = requireCronAuth(makeReq({}))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns 401 when token does not match', () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const result = requireCronAuth(makeReq({ authorization: 'Bearer wrong' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns 401 when authorization header is not Bearer format', () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const result = requireCronAuth(makeReq({ authorization: 'Basic cron-secret' }))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })
})
