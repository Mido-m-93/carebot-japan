import { describe, it, expect } from 'vitest'
import { timeAgo } from './timeAgo'

describe('timeAgo', () => {
  it('30秒前は "30s ago" を返す', () => {
    const iso = new Date(Date.now() - 30_000).toISOString()
    expect(timeAgo(iso)).toBe('30s ago')
  })

  it('5分前は "5m ago" を返す', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(timeAgo(iso)).toBe('5m ago')
  })

  it('3時間前は "3h ago" を返す', () => {
    const iso = new Date(Date.now() - 3 * 3600_000).toISOString()
    expect(timeAgo(iso)).toBe('3h ago')
  })

  it('2日前は "2d ago" を返す', () => {
    const iso = new Date(Date.now() - 2 * 86400_000).toISOString()
    expect(timeAgo(iso)).toBe('2d ago')
  })
})
