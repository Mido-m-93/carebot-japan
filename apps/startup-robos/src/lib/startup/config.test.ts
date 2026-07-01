import { describe, it, expect } from 'vitest'
import { MAX_PIVOTS, TYPE_CONFIG, SITE_URLS } from './config'

describe('MAX_PIVOTS', () => {
  it('equals 30', () => {
    expect(MAX_PIVOTS).toBe(30)
  })
})

describe('TYPE_CONFIG', () => {
  it.each(Object.entries(TYPE_CONFIG))('%s has label, color, and bg', (_key, cfg) => {
    expect(cfg.label).toEqual(expect.any(String))
    expect(cfg.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(cfg.bg).toMatch(/^rgba\(/)
  })
})

describe('SITE_URLS', () => {
  it.each(Object.entries(SITE_URLS))('%s starts with https', (_name, url) => {
    expect(url).toMatch(/^https:\/\//)
  })
})
