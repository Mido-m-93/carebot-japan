import type { SupabaseClient } from '@supabase/supabase-js'
import { callLLM } from '@/lib/agent/llm'

export interface HeartbeatTaskInput {
  model: string
  maxTokens: number
  prompt: string
  systemPrompt: string
  startupId: string
  taskType: string
  /** cron 実行時はユーザーが存在しないため省略可。省略時は null として記録される。 */
  userId?: string
}

export interface HeartbeatTaskResult {
  content: string
  costUsd: number
}

export async function runHeartbeatTask(
  supabase: SupabaseClient,
  input: HeartbeatTaskInput,
): Promise<HeartbeatTaskResult> {
  const result = await callLLM({
    model: input.model,
    maxTokens: input.maxTokens,
    prompt: input.prompt,
    system: input.systemPrompt,
  })

  const { error: insertError } = await supabase.from('agent_runs').insert({
    user_id: input.userId ?? null,
    startup_id: input.startupId,
    model: input.model,
    tokens_input: result.tokensIn,
    tokens_output: result.tokensOut,
    cost_usd: result.costUsd,
    task_type: input.taskType,
    result: result.text,
  })
  if (insertError) {
    console.error('[heartbeatRunner] agent_runs insert 失敗（コスト記録漏れ）', insertError)
  }

  return { content: result.text, costUsd: result.costUsd }
}
