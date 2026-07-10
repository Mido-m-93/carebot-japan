import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCronAuth } from '@/lib/auth'
import { runHeartbeatTask } from '@/lib/agent/heartbeatRunner'
import { getModelForTask } from '@/lib/agent/modelRouting'
import type { TaskType } from '@/lib/agent/responseSchemas'

// CXO heartbeat runs 5 parallel AI calls
export const maxDuration = 300

type Startup = { id: string; name: string; business_type: string }

/** DBから取得したユーザー入力値をプロンプトに埋め込む前にサニタイズする */
function sanitizeForPrompt(text: string, maxLen = 200): string {
  return text
    .slice(0, maxLen)
    .replace(/^(#{1,6})\s/gm, '\\$1 ') // markdown heading injection 対策
}

// Business-specific CXO task templates (CMO + CTO), keyed by business_type.
// {name} is replaced with the actual startup name from the DB, sanitized.
const BUSINESS_TASKS: Record<string, { role: string; task_type: TaskType; prompt: (name: string) => string }> = {
  affiliate_seo: {
    role: 'CMO',
    task_type: 'market_research',
    prompt: (name) => `You are an SEO-specialist CMO. Propose 3 ideas to improve customer acquisition for ${name} (SEO/affiliate content site).
Be specific with keyword strategies, article title suggestions, and internal linking improvements. Keep each proposal to 2-3 lines.`,
  },
  digital_product: {
    role: 'CMO',
    task_type: 'market_research',
    prompt: (name) => `You are a digital product CMO. Propose 3 sales promotion ideas for ${name} (digital products sold on Gumroad).
Consider social strategies, landing page improvements, and pricing. Keep each proposal to 2-3 lines.`,
  },
  game_ads: {
    role: 'CTO',
    task_type: 'cto_review',
    prompt: (name) => `You are a game development CTO. Propose 3 engagement improvement ideas for ${name} (ad-supported HTML5 games).
Consider feature additions, UX improvements, and SEO optimization. Keep each proposal to 2-3 lines.`,
  },
  saas_subscription: {
    role: 'CMO',
    task_type: 'market_research',
    prompt: (name) => `You are a SaaS growth CMO. Propose 3 ideas to get the first paying customers for ${name} (subscription SaaS).
Consider outreach channels, onboarding/trial friction, and pricing or positioning changes. Keep each proposal to 2-3 lines.`,
  },
}

// Cross-functional CXO tasks (COO + CFO) — built dynamically from whichever businesses are active
const CROSS_CXO_TASKS: Array<{ role: string; task_type: TaskType; prompt: (context: string) => string }> = [
  {
    role: 'COO',
    task_type: 'ops_review',
    prompt: (context) => `You are the COO (Chief Operating Officer) of StartupRobos. Review the operations of these businesses:
${context}

Report on:
1. Any deployment or hosting challenges
2. Monitoring and alerting improvement suggestions
3. One critical operations task to do next`,
  },
  {
    role: 'CFO',
    task_type: 'budget_review',
    prompt: (context) => `You are the CFO (Chief Financial Officer) of StartupRobos. Review the monetization status of these businesses:
${context}

Report on:
1. Expected monthly revenue per channel
2. Cost structure (API costs, hosting)
3. One proposal to improve revenue`,
  },
]

function buildCrossContext(startups: Startup[]): string {
  return startups
    .map(s => `- ${sanitizeForPrompt(s.name, 80)} (${sanitizeForPrompt(s.business_type ?? '', 40)})`)
    .join('\n')
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  const { data: startups } = await supabase
    .from('startups')
    .select('id, name, business_type')
    .eq('status', 'active')

  if (!startups?.length) {
    return NextResponse.json({ message: 'No startups found' })
  }

  // Business-specific (CMO / CTO) + Cross-functional (COO / CFO) を並列実行
  const businessPromises = startups
    .filter(s => BUSINESS_TASKS[s.business_type])
    .map(async startup => {
      const task = BUSINESS_TASKS[startup.business_type]
      const model = await getModelForTask(task.task_type, supabase)
      const { content, costUsd } = await runHeartbeatTask(supabase, {
        model,
        maxTokens: 800,
        prompt: task.prompt(sanitizeForPrompt(startup.name, 80)),
        systemPrompt: `You are the ${task.role} of StartupRobos. Provide actionable and specific recommendations.`,
        startupId: startup.id,
        taskType: task.task_type,
      })
      return { startup: startup.name, role: task.role, suggestions: content, costUsd }
    })

  const crossContext = buildCrossContext(startups)
  const crossPromises = CROSS_CXO_TASKS.map(async task => {
    const model = await getModelForTask(task.task_type, supabase)
    const { content, costUsd } = await runHeartbeatTask(supabase, {
      model,
      maxTokens: 800,
      prompt: task.prompt(crossContext),
      systemPrompt: `You are the ${task.role} of StartupRobos. Provide actionable and specific recommendations.`,
      startupId: startups[0].id,
      taskType: task.task_type,
    })
    return { role: task.role, report: content, costUsd }
  })

  const allResults = await Promise.all([...businessPromises, ...crossPromises])
  const totalCost = allResults.reduce((sum, r) => sum + r.costUsd, 0)
  const results = allResults.map(({ costUsd: _c, ...rest }) => rest)

  return NextResponse.json({ ok: true, total_cost_usd: totalCost, results })
}
