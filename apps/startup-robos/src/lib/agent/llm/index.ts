import type { LLMRequest, LLMResult } from './types'

export type { LLMRequest, LLMResult } from './types'

export async function callLLM(req: LLMRequest): Promise<LLMResult> {
  if (req.model.includes('/')) {
    const { callOpenRouter } = await import('./openrouterProvider')
    return callOpenRouter(req)
  }
  const { callAnthropic } = await import('./anthropicProvider')
  return callAnthropic(req)
}
