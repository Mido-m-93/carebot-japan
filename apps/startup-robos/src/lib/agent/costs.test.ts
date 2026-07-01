import { describe, it, expect } from 'vitest'
import { calcCost, TOKEN_COSTS, type ModelName } from './costs'

describe('calcCost', () => {
  it('haiku モデルのコストを正しく計算する', () => {
    // 1M tokens = $1.00 input, $5.00 output
    const cost = calcCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(6.00, 5)
  })

  it('sonnet モデルのコストを正しく計算する', () => {
    // 1M tokens = $3.00 input, $15.00 output
    const cost = calcCost('claude-sonnet-4-6', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(18.00, 5)
  })

  it('トークン数ゼロの場合はゼロを返す', () => {
    expect(calcCost('claude-haiku-4-5-20251001', 0, 0)).toBe(0)
  })

  it('少数トークンのコストを正しく計算する（1000 input, 500 output）', () => {
    // haiku: 1000/1M * 1.00 + 500/1M * 5.00 = 0.001 + 0.0025 = 0.0035
    const cost = calcCost('claude-haiku-4-5-20251001', 1000, 500)
    expect(cost).toBeCloseTo(0.0035, 6)
  })

  it('未知のモデル名の場合は Error を throw する', () => {
    expect(() => calcCost('unknown-model', 1000, 1000)).toThrowError(/unknown model/i)
  })
})

describe('TOKEN_COSTS', () => {
  it('全ての ModelName キーが定義されている', () => {
    const models: ModelName[] = [
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
    ]
    for (const m of models) {
      expect(TOKEN_COSTS[m]).toBeDefined()
      expect(TOKEN_COSTS[m].input).toBeGreaterThan(0)
      expect(TOKEN_COSTS[m].output).toBeGreaterThan(0)
    }
  })
})
