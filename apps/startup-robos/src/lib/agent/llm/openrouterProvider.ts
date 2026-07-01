import type { LLMRequest, LLMResult } from './types'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterUsage {
  prompt_tokens: number
  completion_tokens: number
  cost?: number
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>
  usage: OpenRouterUsage
}

export async function callOpenRouter(req: LLMRequest): Promise<LLMResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const body = {
    model: req.model,
    max_tokens: req.maxTokens,
    messages: [
      { role: 'system' as const, content: req.system },
      { role: 'user' as const, content: req.prompt },
    ],
    usage: { include: true },
  }

  const res = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://startuprobo.com',
      'X-Title': 'StartupRobos',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as OpenRouterResponse
  const text = data.choices[0]?.message?.content ?? ''
  const tokensIn = data.usage.prompt_tokens
  const tokensOut = data.usage.completion_tokens
  const costUsd = data.usage.cost ?? 0

  return { text, tokensIn, tokensOut, costUsd, provider: 'openrouter' }
}
