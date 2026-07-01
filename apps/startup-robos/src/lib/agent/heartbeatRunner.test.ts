import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LLMResult } from '@/lib/agent/llm'

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }))
vi.mock('@/lib/agent/llm', () => ({
  callLLM: mockCallLLM,
}))

import { runHeartbeatTask, type HeartbeatTaskInput } from './heartbeatRunner'

function makeSupabase(): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  } as unknown as SupabaseClient
}

function makeLLMResult(text: string, tokensIn = 100, tokensOut = 50, costUsd = 0.001): LLMResult {
  return { text, tokensIn, tokensOut, costUsd, provider: 'anthropic' }
}

describe('runHeartbeatTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseInput: HeartbeatTaskInput = {
    model: 'claude-sonnet-4-6',
    maxTokens: 800,
    prompt: 'Test prompt',
    systemPrompt: 'You are a test agent.',
    startupId: 'startup-1',
    taskType: 'market_research',
  }

  it('callLLM に正しいパラメータを渡す', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('result'))
    const supabase = makeSupabase()

    await runHeartbeatTask(supabase, baseInput)

    expect(mockCallLLM).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      maxTokens: 800,
      prompt: 'Test prompt',
      system: 'You are a test agent.',
    })
  })

  it('agent_runs に正しいフィールドで INSERT される', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('AI output', 200, 100, 0.0021))
    const supabase = makeSupabase()

    await runHeartbeatTask(supabase, baseInput)

    const fromCall = (supabase.from as ReturnType<typeof vi.fn>)
    expect(fromCall).toHaveBeenCalledWith('agent_runs')
    const insertCall = fromCall.mock.results[0].value.insert
    expect(insertCall).toHaveBeenCalledWith({
      user_id: null,
      startup_id: 'startup-1',
      model: 'claude-sonnet-4-6',
      tokens_input: 200,
      tokens_output: 100,
      cost_usd: 0.0021,
      task_type: 'market_research',
      result: 'AI output',
    })
  })

  it('content と costUsd を返す', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('AI output', 200, 100, 0.0021))
    const supabase = makeSupabase()

    const result = await runHeartbeatTask(supabase, baseInput)

    expect(result.content).toBe('AI output')
    expect(result.costUsd).toBeCloseTo(0.0021, 6)
  })

  it('OpenRouter モデルでもそのまま動作する', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('open response', 200, 100, 0.00005))
    const supabase = makeSupabase()

    const result = await runHeartbeatTask(supabase, {
      ...baseInput,
      model: 'deepseek/deepseek-v4-flash',
    })

    expect(result.content).toBe('open response')
    expect(result.costUsd).toBeCloseTo(0.00005, 8)
    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek/deepseek-v4-flash' })
    )
  })
})
