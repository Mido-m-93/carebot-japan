import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LLMResult } from './types'

const mockCallAnthropic = vi.fn<(req: unknown) => Promise<LLMResult>>()
const mockCallOpenRouter = vi.fn<(req: unknown) => Promise<LLMResult>>()
const mockCallGroq = vi.fn<(req: unknown) => Promise<LLMResult>>()

vi.mock('./anthropicProvider', () => ({
  callAnthropic: (req: unknown) => mockCallAnthropic(req),
}))
vi.mock('./openrouterProvider', () => ({
  callOpenRouter: (req: unknown) => mockCallOpenRouter(req),
}))
vi.mock('./groqProvider', () => ({
  callGroq: (req: unknown) => mockCallGroq(req),
}))

import { callLLM } from './index'

const BASE_REQUEST = {
  system: 'You are a test agent.',
  prompt: 'Hello',
  maxTokens: 100,
}

const ANTHROPIC_RESULT: LLMResult = {
  text: 'anthropic response',
  tokensIn: 100,
  tokensOut: 50,
  costUsd: 0.001,
  provider: 'anthropic',
}

const OPENROUTER_RESULT: LLMResult = {
  text: 'openrouter response',
  tokensIn: 100,
  tokensOut: 50,
  costUsd: 0.0001,
  provider: 'openrouter',
}

const GROQ_RESULT: LLMResult = {
  text: 'groq response',
  tokensIn: 100,
  tokensOut: 50,
  costUsd: 0,
  provider: 'groq',
}

describe('callLLM — provider dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallAnthropic.mockResolvedValue(ANTHROPIC_RESULT)
    mockCallOpenRouter.mockResolvedValue(OPENROUTER_RESULT)
    mockCallGroq.mockResolvedValue(GROQ_RESULT)
  })

  it('claude-* モデルは Anthropic へルーティングされる', async () => {
    const result = await callLLM({ ...BASE_REQUEST, model: 'claude-sonnet-4-6' })

    expect(result.provider).toBe('anthropic')
    expect(result.text).toBe('anthropic response')
    expect(mockCallAnthropic).toHaveBeenCalledOnce()
    expect(mockCallOpenRouter).not.toHaveBeenCalled()
  })

  it('claude-haiku も Anthropic へルーティングされる', async () => {
    await callLLM({ ...BASE_REQUEST, model: 'claude-haiku-4-5-20251001' })

    expect(mockCallAnthropic).toHaveBeenCalledOnce()
    expect(mockCallOpenRouter).not.toHaveBeenCalled()
  })

  it('vendor/model 形式は OpenRouter へルーティングされる', async () => {
    const result = await callLLM({ ...BASE_REQUEST, model: 'deepseek/deepseek-v4-flash' })

    expect(result.provider).toBe('openrouter')
    expect(result.text).toBe('openrouter response')
    expect(mockCallOpenRouter).toHaveBeenCalledOnce()
    expect(mockCallAnthropic).not.toHaveBeenCalled()
  })

  it('moonshotai/kimi-k2.6 も OpenRouter へルーティングされる', async () => {
    await callLLM({ ...BASE_REQUEST, model: 'moonshotai/kimi-k2.6' })

    expect(mockCallOpenRouter).toHaveBeenCalledOnce()
  })

  it('groq/ プレフィックスは Groq へルーティングされ、プレフィックスが除去される', async () => {
    const result = await callLLM({ ...BASE_REQUEST, model: 'groq/llama-3.3-70b-versatile' })

    expect(result.provider).toBe('groq')
    expect(mockCallGroq).toHaveBeenCalledOnce()
    expect(mockCallGroq).toHaveBeenCalledWith({ ...BASE_REQUEST, model: 'llama-3.3-70b-versatile' })
    expect(mockCallOpenRouter).not.toHaveBeenCalled()
    expect(mockCallAnthropic).not.toHaveBeenCalled()
  })

  it('リクエストオブジェクトがそのまま provider に渡される', async () => {
    const req = { ...BASE_REQUEST, model: 'deepseek/deepseek-v4-flash' }
    await callLLM(req)

    expect(mockCallOpenRouter).toHaveBeenCalledWith(req)
  })

  it('LLMResult の全フィールドがそのまま返る', async () => {
    const result = await callLLM({ ...BASE_REQUEST, model: 'claude-opus-4-6' })

    expect(result).toEqual(ANTHROPIC_RESULT)
  })
})
