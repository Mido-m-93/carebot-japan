import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BudgetExhaustedError } from '@/lib/agent/budgetDeduction'
import type { LLMResult } from '@/lib/agent/llm'

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }))
vi.mock('@/lib/agent/llm', () => ({
  callLLM: mockCallLLM,
}))

import { runAgent } from './harness'

function makeSupabase(
  remaining: number | null,
  deductOk = true,
): SupabaseClient {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })

  return {
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === 'check_budget') {
        if (remaining === null) {
          return Promise.resolve({ data: null, error: { message: 'not found' } })
        }
        return Promise.resolve({ data: [{ remaining }], error: null })
      }
      if (name === 'spend_budget') {
        if (!deductOk) {
          return Promise.resolve({ data: [], error: null })
        }
        return Promise.resolve({ data: [{ remaining: remaining ?? 0 }], error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    from: vi.fn(() => ({ insert: mockInsert })),
    _mockInsert: mockInsert,
  } as unknown as SupabaseClient
}

function makeLLMResult(text: string, tokensIn = 100, tokensOut = 50, costUsd = 0.0007): LLMResult {
  return { text, tokensIn, tokensOut, costUsd, provider: 'anthropic' }
}

const BASE_CONFIG = {
  userId: 'user-abc',
  startupId: 'startup-xyz',
  taskType: 'market_research' as const,
}

describe('runAgent — pre-flight budget check', () => {
  it('throws BudgetExhaustedError when remaining is zero', async () => {
    const supabase = makeSupabase(0)
    await expect(runAgent(BASE_CONFIG, 'any prompt', supabase)).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws BudgetExhaustedError when remaining is negative', async () => {
    const supabase = makeSupabase(-5)
    await expect(runAgent(BASE_CONFIG, 'any prompt', supabase)).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws generic Error when budget row is not found', async () => {
    const supabase = makeSupabase(null)
    await expect(runAgent(BASE_CONFIG, 'any prompt', supabase)).rejects.toThrow('Budget information not found')
    await expect(runAgent(BASE_CONFIG, 'any prompt', supabase)).rejects.not.toThrow(BudgetExhaustedError)
  })
})

describe('runAgent — 正常系', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AgentResult の全フィールドが正しく返る', async () => {
    const longResponse = 'AI市場は急速に成長しており、多くの競合他社が参入している。差別化戦略が重要。'
    mockCallLLM.mockResolvedValue(makeLLMResult(longResponse, 200, 100, 0.0007))
    const supabase = makeSupabase(10.0)

    const result = await runAgent(BASE_CONFIG, 'analyze this market', supabase)

    expect(result.content).toBe(longResponse)
    expect(result.tokensUsed).toEqual({ input: 200, output: 100 })
    expect(result.costUsd).toBeCloseTo(0.0007, 6)
    expect(result.budgetRemaining).toBe(10.0)
    expect(result.structured).not.toBeNull()
  })

  it('agent_runs に正しいフィールドで INSERT される', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('result text', 150, 80, 0.001))
    const supabase = makeSupabase(5.0)

    await runAgent(BASE_CONFIG, 'prompt', supabase)

    const insertCall = ((supabase as unknown as { _mockInsert: ReturnType<typeof vi.fn> })._mockInsert)
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-abc',
        startup_id: 'startup-xyz',
        model: 'claude-haiku-4-5-20251001',
        tokens_input: 150,
        tokens_output: 80,
        task_type: 'market_research',
      })
    )
  })

  it('structured が null のとき result フィールドに生テキストが保存される', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('plain text without json', 100, 50, 0.001))
    const supabase = makeSupabase(5.0)

    const result = await runAgent(
      { ...BASE_CONFIG, taskType: 'pivot_analysis' },
      'prompt',
      supabase,
    )

    expect(result.structured).toBeNull()
    const insertCall = ((supabase as unknown as { _mockInsert: ReturnType<typeof vi.fn> })._mockInsert)
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'plain text without json' })
    )
  })

  it('JSON レスポンスが pivot_analysis スキーマに合致するとき structured が non-null', async () => {
    const json = JSON.stringify({ pivot_options: ['Go B2B'], reasoning: 'Higher LTV', risk_level: 'low' })
    mockCallLLM.mockResolvedValue(makeLLMResult(json, 100, 50, 0.001))
    const supabase = makeSupabase(5.0)

    const result = await runAgent(
      { ...BASE_CONFIG, taskType: 'pivot_analysis' },
      'prompt',
      supabase,
    )

    expect(result.structured).not.toBeNull()
    expect(result.structured!['risk_level']).toBe('low')
  })
})

describe('runAgent — モデル選択ロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('taskType が pivot_decision のとき sonnet を使う', async () => {
    const json = JSON.stringify({ decision: 'go', confidence: 80, rationale: 'ok' })
    mockCallLLM.mockResolvedValue(makeLLMResult(json, 100, 50, 0.00105))
    const supabase = makeSupabase(5.0)

    await runAgent({ ...BASE_CONFIG, taskType: 'pivot_decision' }, 'decide', supabase)

    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' })
    )
  })

  it('taskType が market_research のとき haiku を使う', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('research', 100, 50, 0.0007))
    const supabase = makeSupabase(5.0)

    await runAgent(BASE_CONFIG, 'research', supabase)

    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' })
    )
  })

  it('config.model を明示した場合はそのモデルが使われる', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('result', 100, 50, 0.001))
    const supabase = makeSupabase(5.0)

    await runAgent({ ...BASE_CONFIG, model: 'deepseek/deepseek-v4-flash' }, 'prompt', supabase)

    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek/deepseek-v4-flash' })
    )
  })
})

describe('runAgent — TOCTOU: deductBudget が ok: false を返す', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pre-flight 通過後に deductBudget が失敗したとき BudgetExhaustedError を throw する', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('result', 100, 50, 0.001))
    const supabase = makeSupabase(5.0, false)

    await expect(runAgent(BASE_CONFIG, 'prompt', supabase)).rejects.toThrow(BudgetExhaustedError)
  })
})
