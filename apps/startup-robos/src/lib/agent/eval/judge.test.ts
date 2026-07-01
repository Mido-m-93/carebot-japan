import { describe, it, expect, vi } from 'vitest'
import type { GoldenTask } from './goldenTasks'

vi.mock('@/lib/agent/llm', () => ({
  callLLM: vi.fn(),
}))

import { judgeResponse } from './judge'
import { callLLM } from '@/lib/agent/llm'

const mockCallLLM = vi.mocked(callLLM)

const SAMPLE_TASK: GoldenTask = {
  id: 'test-task',
  taskType: 'pivot_decision',
  tier: 'high',
  system: 'You are a CEO.',
  prompt: 'Should we pivot?',
  maxTokens: 500,
}

function makeLLMResult(text: string) {
  return { text, tokensIn: 100, tokensOut: 50, costUsd: 0.001, provider: 'openrouter' as const }
}

describe('judgeResponse', () => {
  it('正常な JSON レスポンスを解析する', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('{"score": 8.5, "reasoning": "Good analysis"}'))
    const result = await judgeResponse(SAMPLE_TASK, 'Test response')
    expect(result.score).toBe(8.5)
    expect(result.reasoning).toBe('Good analysis')
  })

  it('スコアを 0-10 に制限する', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('{"score": 15, "reasoning": "Too high"}'))
    const result = await judgeResponse(SAMPLE_TASK, 'Test response')
    expect(result.score).toBe(10)
  })

  it('JSON が埋め込まれたテキストでも解析できる', async () => {
    mockCallLLM.mockResolvedValue(
      makeLLMResult('Here is my evaluation:\n{"score": 7, "reasoning": "Decent"}\nEnd.'),
    )
    const result = await judgeResponse(SAMPLE_TASK, 'Test response')
    expect(result.score).toBe(7)
  })

  it('JSON なしの場合はスコア 0 を返す', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('I cannot evaluate this.'))
    const result = await judgeResponse(SAMPLE_TASK, 'Test response')
    expect(result.score).toBe(0)
    expect(result.reasoning).toBe('Judge returned no JSON')
  })

  it('DeepSeek V4 Pro を judge モデルとして使用する', async () => {
    mockCallLLM.mockResolvedValue(makeLLMResult('{"score": 8, "reasoning": "Good"}'))
    await judgeResponse(SAMPLE_TASK, 'Test response')
    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek/deepseek-v4-pro' }),
    )
  })
})
