import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_RESPONSE = {
  choices: [{ message: { content: 'Llama response' } }],
  usage: { prompt_tokens: 200, completion_tokens: 100 },
}

describe('callGroq', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, GROQ_API_KEY: 'test-key-123' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  async function loadAndCall() {
    const { callGroq } = await import('./groqProvider')
    return callGroq({
      model: 'llama-3.3-70b-versatile',
      system: 'You are a CTO.',
      prompt: 'Analyze this.',
      maxTokens: 600,
    })
  }

  it('正しい URL・ヘッダ・ボディで fetch を呼ぶ', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(MOCK_RESPONSE)))

    await loadAndCall()

    expect(fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key-123',
          'Content-Type': 'application/json',
        }),
      }),
    )

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.max_tokens).toBe(600)
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are a CTO.' },
      { role: 'user', content: 'Analyze this.' },
    ])
  })

  it('LLMResult を正しく返す（costUsd は常に 0）', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(MOCK_RESPONSE)))

    const result = await loadAndCall()

    expect(result).toEqual({
      text: 'Llama response',
      tokensIn: 200,
      tokensOut: 100,
      costUsd: 0,
      provider: 'groq',
    })
  })

  it('API エラー時に throw する', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Rate limit exceeded', { status: 429, statusText: 'Too Many Requests' })
    )

    await expect(loadAndCall()).rejects.toThrow('Groq API error 429')
  })

  it('GROQ_API_KEY が未設定のとき throw する', async () => {
    delete process.env.GROQ_API_KEY

    await expect(loadAndCall()).rejects.toThrow('GROQ_API_KEY is not set')
  })
})
