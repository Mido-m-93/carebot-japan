export interface LLMRequest {
  model: string
  system: string
  prompt: string
  maxTokens: number
}

export interface LLMResult {
  text: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  provider: 'anthropic' | 'openrouter' | 'groq'
}
