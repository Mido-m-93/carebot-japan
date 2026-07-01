import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/agent/llm', () => ({
  callLLM: vi.fn(),
}))

import { runOptimizer } from './optimizer'
import { callLLM } from '@/lib/agent/llm'

const mockCallLLM = vi.mocked(callLLM)

function makeLLMResult(text: string, costUsd = 0.001) {
  return { text, tokensIn: 100, tokensOut: 50, costUsd, provider: 'openrouter' as const }
}

let mockUpsert: ReturnType<typeof vi.fn>
let mockInsert: ReturnType<typeof vi.fn>

function makeSupabase(currentModel: string | null = null): SupabaseClient {
  mockUpsert = vi.fn().mockResolvedValue({ error: null })
  mockInsert = vi.fn().mockResolvedValue({ error: null })
  return {
    from: vi.fn((table: string) => {
      if (table === 'model_config') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: currentModel ? { model: currentModel } : null,
                error: currentModel ? null : { message: 'not found' },
              }),
            })),
          })),
          upsert: mockUpsert,
        }
      }
      if (table === 'model_selection_history') {
        return { insert: mockInsert }
      }
      return { select: vi.fn(), insert: vi.fn(), upsert: vi.fn() }
    }),
  } as unknown as SupabaseClient
}

describe('runOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全候補を評価して結果を返す', async () => {
    // 候補モデルの応答（schema に合うもの）
    mockCallLLM.mockImplementation(async (req) => {
      if (req.model === 'deepseek/deepseek-v4-pro') {
        return makeLLMResult('{"score": 8.0, "reasoning": "Good"}')
      }
      if (req.system.includes('pivot_decision') || req.system.includes('CEO')) {
        return makeLLMResult('{"decision": "go", "confidence": 80, "rationale": "Strong signal"}')
      }
      if (req.system.includes('CTO')) {
        return makeLLMResult('{"core_feature": "chatbot", "validation_metric": "usage", "build_time_estimate": "2 weeks", "tech_stack_suggestion": "Next.js"}')
      }
      if (req.system.includes('strategist')) {
        return makeLLMResult('{"pivot_options": ["B2B", "niche"], "reasoning": "Low conversion", "risk_level": "medium"}')
      }
      return makeLLMResult('This is a detailed analysis with actionable recommendations for the business.')
    })

    const supabase = makeSupabase('moonshotai/kimi-k2.6')
    const result = await runOptimizer(supabase)

    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.totalCostUsd).toBeGreaterThan(0)
    expect(typeof result.budgetExhausted).toBe('boolean')
  })

  it('schema チェックに落ちた候補は選ばれない', async () => {
    let callCount = 0
    mockCallLLM.mockImplementation(async (req) => {
      callCount++
      if (req.model === 'deepseek/deepseek-v4-pro') {
        return makeLLMResult('{"score": 9.0, "reasoning": "Excellent"}')
      }
      // 全候補で JSON パース不可な応答を返す
      return makeLLMResult('This is not valid JSON for any schema')
    })

    const supabase = makeSupabase()
    const result = await runOptimizer(supabase)

    // schema 全パスできない → selected は null
    expect(result.selected.high).toBeNull()
    expect(result.selected.low).toBeNull()
    // kept_current の履歴が挿入されている
    expect(mockInsert).toHaveBeenCalled()
  })

  it('予算超過時に budgetExhausted を true にする', async () => {
    // 高コストの応答で予算を消費させる
    mockCallLLM.mockResolvedValue(makeLLMResult('{"decision": "go", "confidence": 80, "rationale": "test"}', 0.5))

    const supabase = makeSupabase()
    const result = await runOptimizer(supabase)

    expect(result.budgetExhausted).toBe(true)
  })
})
