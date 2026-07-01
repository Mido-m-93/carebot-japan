import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCronAuth } from '@/lib/auth'
import { runOptimizer } from '@/lib/agent/eval/optimizer'
import { sendReport } from '@/lib/notify'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  try {
    const result = await runOptimizer(supabase)

    const lines = ['## Model Optimizer Results\n']
    for (const tier of ['high', 'low'] as const) {
      const sel = result.selected[tier]
      if (sel) {
        lines.push(`**${tier} tier**: ${sel.model} (score: ${sel.score.toFixed(1)}, cost: $${sel.cost.toFixed(4)})`)
      } else {
        lines.push(`**${tier} tier**: No change (no candidate met quality floor)`)
      }
    }
    lines.push(`\nTotal eval cost: $${result.totalCostUsd.toFixed(4)}`)
    if (result.budgetExhausted) {
      lines.push('⚠️ Budget exhausted before completing all evaluations')
    }

    await sendReport(
      `Model Optimizer — ${new Date().toLocaleDateString('en-US')}`,
      lines.join('\n'),
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[optimizer] Failed:', message)

    await sendReport(
      `Model Optimizer FAILED — ${new Date().toLocaleDateString('en-US')}`,
      `Optimizer encountered an error:\n${message}`,
    ).catch(() => {})

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
