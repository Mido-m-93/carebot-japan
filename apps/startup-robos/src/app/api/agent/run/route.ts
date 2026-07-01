import { NextRequest, NextResponse } from 'next/server'
import { runAgent, AgentConfig } from '@/lib/agent/harness'
import { createServiceClient } from '@/lib/supabase/server'
import { maskPII } from '@/lib/security/piiMasker'
import { requireApiAuth } from '@/lib/auth'
import { makeRateLimiter } from '@/lib/rateLimit'
import { BudgetExhaustedError } from '@/lib/agent/budgetDeduction'
import { z } from 'zod'

// Vercel serverless function timeout (seconds)
export const maxDuration = 300

// Upstash Redis スライディングウィンドウ: 10リクエスト / 60秒 / ユーザー
const checkRateLimit = makeRateLimiter(10, 60)

const requestSchema = z.object({
  startupId: z.string().uuid(),
  taskType: z.enum(['pivot_analysis', 'market_research', 'mvp_spec', 'pivot_decision']),
  prompt: z.string().min(1).max(5000),
})

export async function POST(req: NextRequest) {
  // API key authentication
  const authError = requireApiAuth(req)
  if (authError) return authError

  // middleware で検証済みのユーザーID（x-user-id ヘッダー）
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit check (10 requests/min per user)
  if (!(await checkRateLimit(userId))) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please retry after 1 minute.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input values', details: parsed.error.issues }, { status: 400 })
  }

  const { startupId, taskType, prompt } = parsed.data

  const supabaseService = createServiceClient()

  // Verify startup exists AND belongs to the authenticated user (IDOR prevention)
  const { data: startup } = await supabaseService
    .from('startups')
    .select('id, user_id')
    .eq('id', startupId)
    .single()

  if (!startup) {
    return NextResponse.json({ error: 'Startup not found' }, { status: 404 })
  }
  if (startup.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // PII masking
  const sanitizedPrompt = maskPII(prompt)
  const config: AgentConfig = { userId, startupId, taskType }

  try {
    // Use startup context without user_id since we're doing public read
    const result = await runAgent(config, sanitizedPrompt, supabaseService)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof BudgetExhaustedError) {
      return NextResponse.json({ error: 'Token budget exhausted' }, { status: 402 })
    }
    console.error('[agent/run]', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
