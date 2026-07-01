import type { SupabaseClient } from '@supabase/supabase-js'
import { callLLM } from '@/lib/agent/llm'
import { RESPONSE_SCHEMAS, type TaskType } from '@/lib/agent/responseSchemas'
import { parseAgentResponse } from '@/lib/agent/responseSchemas'
import { GOLDEN_TASKS, type GoldenTask } from './goldenTasks'
import { judgeResponse } from './judge'

const OPTIMIZER_BUDGET_USD = parseFloat(process.env.OPTIMIZER_BUDGET_USD ?? '1.00')

const CANDIDATES: Record<'high' | 'low', string[]> = {
  high: [
    'moonshotai/kimi-k2.6',
    'z-ai/glm-5.1',
    'qwen/qwen-3.6-max',
    'nousresearch/hermes-4',
  ],
  low: [
    'deepseek/deepseek-v4-flash',
    'qwen/qwen-3.6',
  ],
}

const QUALITY_FLOOR: Record<'high' | 'low', number> = {
  high: 8.0,
  low: 7.0,
}

export interface CandidateResult {
  model: string
  tier: 'high' | 'low'
  schemaPassRate: number
  avgScore: number
  totalCostUsd: number
  tasks: Array<{
    taskId: string
    schemaPassed: boolean
    score: number
    costUsd: number
  }>
}

export interface OptimizerResult {
  selected: Record<'high' | 'low', { model: string; score: number; cost: number } | null>
  candidates: CandidateResult[]
  totalCostUsd: number
  budgetExhausted: boolean
}

async function evalCandidate(
  model: string,
  tasks: GoldenTask[],
  budgetRemaining: { value: number },
): Promise<CandidateResult> {
  const tier = tasks[0]?.tier ?? 'low'
  const taskResults: CandidateResult['tasks'] = []
  let totalCost = 0

  for (const task of tasks) {
    if (budgetRemaining.value <= 0) break

    const llmResult = await callLLM({
      model,
      system: task.system,
      prompt: task.prompt,
      maxTokens: task.maxTokens,
    })

    totalCost += llmResult.costUsd
    budgetRemaining.value -= llmResult.costUsd

    const schema = RESPONSE_SCHEMAS[task.taskType]
    const parsed = parseAgentResponse(llmResult.text, schema)
    const schemaPassed = parsed.parsed !== null

    let score = 0
    if (schemaPassed && budgetRemaining.value > 0) {
      const judgeResult = await judgeResponse(task, llmResult.text)
      score = judgeResult.score
      totalCost += 0 // judge cost は judge 側で発生、ここではカウントしない
    }

    taskResults.push({
      taskId: task.id,
      schemaPassed,
      score,
      costUsd: llmResult.costUsd,
    })
  }

  const passed = taskResults.filter(t => t.schemaPassed)
  const schemaPassRate = taskResults.length > 0
    ? passed.length / taskResults.length
    : 0
  const avgScore = passed.length > 0
    ? passed.reduce((sum, t) => sum + t.score, 0) / passed.length
    : 0

  return { model, tier, schemaPassRate, avgScore, totalCostUsd: totalCost, tasks: taskResults }
}

export async function runOptimizer(
  supabase: SupabaseClient,
): Promise<OptimizerResult> {
  const budgetRemaining = { value: OPTIMIZER_BUDGET_USD }
  const allResults: CandidateResult[] = []
  const selected: Record<'high' | 'low', { model: string; score: number; cost: number } | null> = {
    high: null,
    low: null,
  }

  for (const tier of ['high', 'low'] as const) {
    const tasks = GOLDEN_TASKS.filter(t => t.tier === tier)
    const candidates = CANDIDATES[tier]

    // 現職モデルの防衛枠を含める
    const { data: current } = await supabase
      .from('model_config')
      .select('model')
      .eq('tier', tier)
      .single()
    const currentModel = current?.model
    const candidateList = currentModel && !candidates.includes(currentModel)
      ? [...candidates, currentModel]
      : candidates

    for (const model of candidateList) {
      if (budgetRemaining.value <= 0) break
      const result = await evalCandidate(model, tasks, budgetRemaining)
      allResults.push(result)
    }

    // schema_pass_rate 100% + quality floor を満たす候補から最安を選択
    const qualified = allResults
      .filter(r => r.tier === tier && r.schemaPassRate === 1.0 && r.avgScore >= QUALITY_FLOOR[tier])
      .sort((a, b) => a.totalCostUsd - b.totalCostUsd)

    if (qualified.length > 0) {
      const winner = qualified[0]
      selected[tier] = { model: winner.model, score: winner.avgScore, cost: winner.totalCostUsd }

      await supabase
        .from('model_config')
        .upsert({ tier, model: winner.model, updated_by: 'optimizer', updated_at: new Date().toISOString() })

      await supabase.from('model_selection_history').insert({
        tier,
        selected_model: winner.model,
        quality_score: winner.avgScore,
        schema_pass_rate: winner.schemaPassRate,
        price_in: winner.totalCostUsd,
        price_out: winner.totalCostUsd,
        candidates: allResults.filter(r => r.tier === tier),
        status: 'selected',
      })
    } else {
      await supabase.from('model_selection_history').insert({
        tier,
        selected_model: currentModel ?? 'none',
        quality_score: 0,
        schema_pass_rate: 0,
        price_in: 0,
        price_out: 0,
        candidates: allResults.filter(r => r.tier === tier),
        status: 'kept_current',
      })
    }
  }

  return {
    selected,
    candidates: allResults,
    totalCostUsd: OPTIMIZER_BUDGET_USD - budgetRemaining.value,
    budgetExhausted: budgetRemaining.value <= 0,
  }
}
