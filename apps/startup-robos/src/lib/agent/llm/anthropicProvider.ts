import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { calcCost } from '@/lib/agent/costs'
import type { LLMRequest, LLMResult } from './types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function callAnthropic(req: LLMRequest): Promise<LLMResult> {
  const response = await client.messages.create({
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: 'user', content: req.prompt }],
  })

  const block = response.content[0]
  const text = block?.type === 'text' ? (block.text ?? '') : ''
  const tokensIn = response.usage.input_tokens
  const tokensOut = response.usage.output_tokens

  return {
    text,
    tokensIn,
    tokensOut,
    costUsd: calcCost(req.model, tokensIn, tokensOut),
    provider: 'anthropic',
  }
}
