import type { SupabaseClient } from '@supabase/supabase-js'
import { CXO_SYSTEM_PROMPTS, type CXORole } from './cxo'
import { checkBudgetPreFlight, deductBudget, BudgetExhaustedError } from '@/lib/agent/budgetDeduction'
import { callLLM } from '@/lib/agent/llm'
import { getModelForTask } from '@/lib/agent/modelRouting'

const MIN_BUDGET_USD = 0.20

export interface CouncilResult {
  sessionId: string
  ctoReport: string
  cmoReport: string
  cooReport: string
  cfoReport: string
  ceoDecision: string
  totalCostUsd: number
  budgetRemaining: number
}

interface CXOReport {
  role: CXORole
  content: string
  costUsd: number
  tokensIn: number
  tokensOut: number
  model: string
}


export async function runCouncil(
  userId: string,
  startupId: string,
  startupContext: string,
  agenda: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<CouncilResult> {
  await checkBudgetPreFlight(supabase, userId, MIN_BUDGET_USD)

  const userMessage = `## Startup Context\n${startupContext}\n\n## Agenda\n${agenda}`

  // Step 1: CTO / CMO / COO / CFO in parallel
  const subordinateRoles: Exclude<CXORole, 'ceo'>[] = ['cto', 'cmo', 'coo', 'cfo']

  const reports: CXOReport[] = await Promise.all(
    subordinateRoles.map(async (role): Promise<CXOReport> => {
      const taskType = `cxo_${role}`
      const model = await getModelForTask(taskType, supabase)
      const result = await callLLM({
        model,
        maxTokens: 600,
        system: CXO_SYSTEM_PROMPTS[role],
        prompt: userMessage,
      })
      return {
        role,
        content: result.text,
        costUsd: result.costUsd,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        model,
      }
    })
  )

  const byRole = Object.fromEntries(reports.map(r => [r.role, r])) as Record<Exclude<CXORole, 'ceo'>, CXOReport>

  // Step 2: CEO synthesizes all CXO reports
  const ceoPrompt = [
    `## Startup Context\n${startupContext}`,
    `## Agenda\n${agenda}`,
    `## CTO Report\n${byRole.cto.content}`,
    `## CMO Report\n${byRole.cmo.content}`,
    `## COO Report\n${byRole.coo.content}`,
    `## CFO Report\n${byRole.cfo.content}`,
  ].join('\n\n')

  const ceoModel = await getModelForTask('cxo_ceo', supabase)
  const ceoResult = await callLLM({
    model: ceoModel,
    maxTokens: 1000,
    system: CXO_SYSTEM_PROMPTS['ceo'],
    prompt: ceoPrompt,
  })

  const totalCostUsd = reports.reduce((sum, r) => sum + r.costUsd, 0) + ceoResult.costUsd

  // Batch insert execution logs
  await supabase.from('agent_runs').insert([
    ...reports.map(r => ({
      user_id: userId,
      startup_id: startupId,
      model: r.model,
      tokens_input: r.tokensIn,
      tokens_output: r.tokensOut,
      cost_usd: r.costUsd,
      task_type: `cxo_${r.role}`,
    })),
    {
      user_id: userId,
      startup_id: startupId,
      model: ceoModel,
      tokens_input: ceoResult.tokensIn,
      tokens_output: ceoResult.tokensOut,
      cost_usd: ceoResult.costUsd,
      task_type: 'cxo_ceo',
    },
  ])

  const deduction = await deductBudget(supabase, userId, totalCostUsd)
  if (!deduction.ok) throw new BudgetExhaustedError('Token budget exhausted (concurrent deduction exceeded limit)')

  // Save CXO session
  const { data: session } = await supabase
    .from('cxo_sessions')
    .insert({
      startup_id: startupId,
      user_id: userId,
      agenda,
      cto_report: byRole.cto.content,
      cmo_report: byRole.cmo.content,
      coo_report: byRole.coo.content,
      cfo_report: byRole.cfo.content,
      ceo_decision: ceoResult.text,
      total_cost_usd: totalCostUsd,
    })
    .select('id')
    .single()

  return {
    sessionId: session?.id ?? '',
    ctoReport: byRole.cto.content,
    cmoReport: byRole.cmo.content,
    cooReport: byRole.coo.content,
    cfoReport: byRole.cfo.content,
    ceoDecision: ceoResult.text,
    totalCostUsd,
    budgetRemaining: deduction.remaining ?? 0,
  }
}
