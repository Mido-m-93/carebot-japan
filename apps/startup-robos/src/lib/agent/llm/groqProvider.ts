import type { LLMRequest, LLMResult } from './types'

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'

interface GroqResponse {
  choices: Array<{ message: { content: string } }>
  usage: { prompt_tokens: number; completion_tokens: number }
}

// Groq's free-tier models (Llama, Gemma, etc.) carry no per-token charge,
// so cost is always reported as 0 rather than maintained in a pricing table.
export async function callGroq(req: LLMRequest): Promise<LLMResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens,
      messages: [
        { role: 'system' as const, content: req.system },
        { role: 'user' as const, content: req.prompt },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Groq API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as GroqResponse
  const text = data.choices[0]?.message?.content ?? ''
  const tokensIn = data.usage.prompt_tokens
  const tokensOut = data.usage.completion_tokens

  return { text, tokensIn, tokensOut, costUsd: 0, provider: 'groq' }
}
