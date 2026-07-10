// Anthropic モデルのトークンコスト（USD / 100万トークン）
// OpenRouter モデルのコストは API レスポンスの usage.cost から直接取得するため、ここに登録不要
export const TOKEN_COSTS = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
  'claude-sonnet-5':           { input: 3.00, output: 15.00 },
  'claude-opus-4-8':           { input: 15.00, output: 75.00 },
} as const

export type ModelName = keyof typeof TOKEN_COSTS

export function calcCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = TOKEN_COSTS[model as ModelName]
  if (!costs) throw new Error(`Unknown model: ${model}`)
  return (tokensIn / 1_000_000) * costs.input + (tokensOut / 1_000_000) * costs.output
}
