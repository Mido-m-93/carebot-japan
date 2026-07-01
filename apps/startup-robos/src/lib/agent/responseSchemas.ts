import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'

// --- Anthropic response helpers ---

/**
 * Extracts the text content from the first content block of an Anthropic message.
 * Returns empty string if the first block is not a text block.
 */
export function extractText(response: Pick<Anthropic.Messages.Message, 'content'>): string {
  const block = response.content[0]
  return block?.type === 'text' ? (block.text ?? '') : ''
}

// --- Task types ---
export type TaskType =
  | 'pivot_analysis'
  | 'market_research'
  | 'mvp_spec'
  | 'pivot_decision'
  | 'ops_review'      // COO heartbeat タスク
  | 'budget_review'   // CFO heartbeat タスク
  | 'ceo_review'      // CEO heartbeat タスク（全スタートアップ俯瞰）
  | 'cto_review'      // CTO heartbeat タスク（技術・エンゲージメント改善提案）

// --- Zod schemas for each task type ---
export const PivotAnalysisSchema = z.object({
  pivot_options: z.array(z.string()),
  reasoning: z.string(),
  risk_level: z.enum(['low', 'medium', 'high']),
})

export const MarketResearchSchema = z.object({
  content: z.string().min(20),
})

/**
 * 自由テキスト形式のレスポンス用汎用スキーマ（min: 1）。
 * JSON構造を期待しないタスク（ops_review / budget_review / ceo_review / cto_review）に使用。
 * MarketResearchSchema（min: 20）より制約が緩く、短いシステムレポートにも対応する。
 */
export const FreeTextSchema = z.object({
  content: z.string().min(1),
})

export const MvpSpecSchema = z.object({
  core_feature: z.string(),
  validation_metric: z.string(),
  build_time_estimate: z.string(),
  tech_stack_suggestion: z.string(),
})

export const PivotDecisionSchema = z.object({
  decision: z.enum(['go', 'pivot']),
  confidence: z.number().min(0).max(100),
  rationale: z.string(),
})

// --- Schema map used by harness ---
export const RESPONSE_SCHEMAS: Record<TaskType, z.ZodTypeAny> = {
  pivot_analysis: PivotAnalysisSchema,
  market_research: FreeTextSchema,   // 自由テキスト（CMO マーケットリサーチ）
  mvp_spec: MvpSpecSchema,
  pivot_decision: PivotDecisionSchema,
  ops_review: FreeTextSchema,        // 自由テキスト（COO レポート）
  budget_review: FreeTextSchema,     // 自由テキスト（CFO レポート）
  ceo_review: FreeTextSchema,        // 自由テキスト（CEO 俯瞰レポート）
  cto_review: FreeTextSchema,        // 自由テキスト（CTO 改善提案レポート）
}

/**
 * このスキーマセットに含まれるスキーマは JSON 解析が不要。
 * AI の自由形式テキストをそのまま content フィールドにラップして返す。
 * MarketResearchSchema を含めるのは、直接スキーマを渡すコード（テスト含む）との後方互換のため。
 * RESPONSE_SCHEMAS では market_research → FreeTextSchema を使用。
 */
const RAW_TEXT_SCHEMAS = new Set<z.ZodTypeAny>([MarketResearchSchema, FreeTextSchema])

// --- Parse agent response text against a Zod schema ---
export function parseAgentResponse<T extends z.ZodTypeAny>(
  raw: string,
  schema: T
): { parsed: z.infer<T> | null; error?: string; raw: string } {
  // 自由テキストスキーマ: JSON不要でテキストをラップして返す
  if (RAW_TEXT_SCHEMAS.has(schema)) {
    const result = schema.safeParse({ content: raw })
    if (result.success) {
      return { parsed: result.data as z.infer<T>, raw }
    }
    return { parsed: null, error: result.error.message, raw }
  }

  // Try to extract JSON from the raw text
  const json = extractJson(raw)
  if (json === null) {
    return { parsed: null, error: 'No JSON found in response', raw }
  }

  const result = schema.safeParse(json)
  if (result.success) {
    return { parsed: result.data, raw }
  }
  return { parsed: null, error: result.error.message, raw }
}

// --- Extract JSON object from text (handles fenced blocks, embedded JSON) ---
function extractJson(text: string): unknown | null {
  // 1. Try direct parse
  try {
    return JSON.parse(text)
  } catch {
    // continue
  }

  // 2. Try fenced code block ```json ... ```
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenced) {
    try {
      return JSON.parse(fenced[1])
    } catch {
      // continue
    }
  }

  // 3. Try to find embedded JSON object in prose
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {
      // continue
    }
  }

  return null
}
