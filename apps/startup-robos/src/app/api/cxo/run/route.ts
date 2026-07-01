import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { maskPII } from '@/lib/security/piiMasker'
import { MAX_PIVOTS } from '@/lib/startup/config'
import { runCouncil } from '@/lib/agent/council'
import { requireApiAuth } from '@/lib/auth'
import { makeRateLimiter } from '@/lib/rateLimit'
import { BudgetExhaustedError } from '@/lib/agent/budgetDeduction'

// CXO council runs 5 sequential AI calls — needs generous timeout
export const maxDuration = 300

// Upstash Redis スライディングウィンドウ: CXO会議はリソース消費が大きいため3リクエスト / 60秒 / ユーザー
const checkRateLimit = makeRateLimiter(3, 60)

const requestSchema = z.object({
  startupId: z.string().uuid(),
  agenda: z.string().min(10).max(2000),
})

export async function POST(req: NextRequest) {
  // API key authentication
  const authError = requireApiAuth(req)
  if (authError) return authError

  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await checkRateLimit(userId))) {
    return NextResponse.json({ error: 'CXO meetings limited to 3 per minute' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input values', details: parsed.error.issues }, { status: 400 })
  }

  const { startupId, agenda } = parsed.data
  const supabaseService = createServiceClient()

  // Fetch startup + verify ownership (IDOR prevention)
  const { data: startup } = await supabaseService
    .from('startups')
    .select('id, user_id, name, description, status, pivot_count')
    .eq('id', startupId)
    .single()

  if (!startup) {
    return NextResponse.json({ error: 'Startup not found' }, { status: 404 })
  }
  if (startup.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const startupContext = [
    `Company: ${startup.name}`,
    startup.description ? `Description: ${startup.description}` : '',
    `Status: ${startup.status}`,
    `Pivots: ${startup.pivot_count} / ${MAX_PIVOTS}`,
  ].filter(Boolean).join('\n')

  const sanitizedAgenda = maskPII(agenda)

  try {
    const result = await runCouncil(
      userId,
      startupId,
      startupContext,
      sanitizedAgenda,
      supabaseService
    )
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof BudgetExhaustedError) {
      return NextResponse.json({ error: 'Token budget exhausted' }, { status: 402 })
    }
    console.error('[cxo/run]', err)
    return NextResponse.json({ error: 'An error occurred during the CXO meeting' }, { status: 500 })
  }
}
