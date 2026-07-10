import type { LLMRequest, LLMResult } from './types'

export type { LLMRequest, LLMResult } from './types'

const GROQ_PREFIX = 'groq/'

export async function callLLM(req: LLMRequest): Promise<LLMResult> {
  if (req.model.startsWith(GROQ_PREFIX)) {
    const { callGroq } = await import('./groqProvider')
    return callGroq({ ...req, model: req.model.slice(GROQ_PREFIX.length) })
  }
  if (req.model.includes('/')) {
    const { callOpenRouter } = await import('./openrouterProvider')
    return callOpenRouter(req)
  }
  const { callAnthropic } = await import('./anthropicProvider')
  return callAnthropic(req)
}
