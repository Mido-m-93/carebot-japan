import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendReport } from '@/lib/notify'
import { requireCronAuth } from '@/lib/auth'
import { runHeartbeatTask } from '@/lib/agent/heartbeatRunner'
import { getModelForTask } from '@/lib/agent/modelRouting'

/** DBから取得したユーザー入力値をプロンプトに埋め込む前にサニタイズする */
function sanitizeForPrompt(text: string, maxLen = 200): string {
  return text
    .slice(0, maxLen)
    .replace(/^(#{1,6})\s/gm, '\\$1 ') // markdown heading injection 対策
}

// CEO heartbeat calls Opus which can be slow
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  // Fetch active startups and recent experiments
  const { data: startups } = await supabase
    .from('startups')
    .select('id, name, business_type, status')
    .eq('status', 'active')

  if (!startups?.length) {
    return NextResponse.json({ message: 'No startups found' })
  }

  const { data: experiments } = await supabase
    .from('experiments')
    .select('startup_id, hypothesis, status, result')
    .in('startup_id', startups.map(s => s.id))
    .order('created_at', { ascending: false })

  // Build CEO context for analysis
  // Note: DB values are sanitized before embedding — treat as untrusted input
  const context = startups.map(s => {
    const exps = (experiments ?? []).filter(e => e.startup_id === s.id)
    const recent = exps.slice(0, 3)
      .map(e => `- ${sanitizeForPrompt(e.hypothesis ?? '')} [${e.status}]`)
      .join('\n')
    return `Business: ${sanitizeForPrompt(s.name)} (${sanitizeForPrompt(s.business_type ?? '')})\nRecent experiments:\n${recent || 'none'}`
  }).join('\n\n')

  const prompt = `You are the CEO of Launchpad. Evaluate the status of the following startups and propose the next action for each business:

${context}

For each business:
1. Current challenges (1 line)
2. Next experiment to try (specific details)
3. Priority (High/Medium/Low)`

  const start = Date.now()
  const model = await getModelForTask('ceo_review', supabase)
  const { content, costUsd } = await runHeartbeatTask(supabase, {
    model,
    maxTokens: 1500,
    prompt,
    systemPrompt: 'You are an experienced startup CEO. Make concise and specific decisions based on data.',
    startupId: startups[0].id,
    taskType: 'ceo_review',
  })

  // Send email notification
  const hour = new Date().getUTCHours()
  const period = hour < 6 ? 'Morning' : 'Evening'
  await sendReport(
    `📊 Launchpad ${period} Report — ${new Date().toLocaleDateString('en-US')}`,
    content
  )

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - start,
    cost_usd: costUsd,
    assessment: content,
  })
}
