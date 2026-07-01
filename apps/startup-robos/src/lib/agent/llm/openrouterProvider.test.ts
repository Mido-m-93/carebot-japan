import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_RESPONSE = {
  choices: [{ message: { content: 'DeepSeek response' } }],
  usage: { prompt_tokens: 200, completion_tokens: 100, cost: 0.00005 },
}

describe('callOpenRouter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, OPENROUTER_API_KEY: 'test-key-123' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  async function loadAndCall() {
    const { callOpenRouter } = await import('./openrouterProvider')
    return callOpenRouter({
      model: 'deepseek/deepseek-v4-flash',
      system: 'You are a CTO.',
      prompt: 'Analyze this.',
      maxTokens: 600,
    })
  }

  it('正しい URL・ヘッダ・ボディで fetch を呼ぶ', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(MOCK_RESPONSE)))

    await loadAndCall()

    expect(fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key-123',
          'Content-Type': 'application/json',
        }),
      }),
    )

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('deepseek/deepseek-v4-flash')
    expect(body.max_tokens).toBe(600)
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are a CTO.' },
      { role: 'user', content: 'Analyze this.' },
    ])
    expect(body.usage).toEqual({ include: true })
  })

  it('LLMResult を正しく返す（usage.cost を costUsd に採用）', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(MOCK_RESPONSE)))

    const result = await loadAndCall()

    expect(result).toEqual({
      text: 'DeepSeek response',
      tokensIn: 200,
      tokensOut: 100,
      costUsd: 0.00005,
      provider: 'openrouter',
    })
  })

  it('API エラー時に throw する', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Rate limit exceeded', { status: 429, statusText: 'Too Many Requests' })
    )

    await expect(loadAndCall()).rejects.toThrow('OpenRouter API error 429')
  })

  it('OPENROUTER_API_KEY が未設定のとき throw する', async () => {
    delete process.env.OPENROUTER_API_KEY

    await expect(loadAndCall()).rejects.toThrow('OPENROUTER_API_KEY is not set')
  })

  it('usage.cost が未定義のとき costUsd を 0 にする', async () => {
    const noCostResponse = {
      choices: [{ message: { content: 'text' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(noCostResponse)))

    const result = await loadAndCall()

    expect(result.costUsd).toBe(0)
  })
})
