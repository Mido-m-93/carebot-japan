import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authError = requireApiAuth(req)
  if (authError) return authError

  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // startups を先に取得し、そのIDで experiments をフィルタ（IDOR防止）
  const startupsRes = await supabase
    .from('startups')
    .select('id, name, status, business_type, experiment_count, pivot_count, created_at')
    .eq('user_id', userId)
    .order('created_at')

  const startupIds = (startupsRes.data || []).map(s => s.id)

  const [experimentsRes, runsRes, budgetRes] = await Promise.all([
    startupIds.length
      ? supabase
          .from('experiments')
          .select('id, startup_id, hypothesis, metric, target_value, status, result, started_at, completed_at')
          .in('startup_id', startupIds)
          .order('created_at')
      : Promise.resolve({ data: [] as unknown[], error: null }),
    supabase
      .from('agent_runs')
      .select('id, startup_id, model, task_type, cost_usd, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('token_budgets')
      .select('*')
      .eq('user_id', userId)
      .single(),
  ])

  return NextResponse.json({
    startups: startupsRes.data || [],
    experiments: experimentsRes.data || [],
    recentRuns: runsRes.data || [],
    budget: budgetRes.data || null,
  })
}
