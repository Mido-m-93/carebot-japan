export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/timeAgo'

// エージェントロール定義（task_type → role のマッピング）
const AGENT_PROFILES: Record<string, {
  label: string
  title: string
  model: string
  modelId: string
  color: string
  bgColor: string
  taskType: string
  heartbeat: string
  description: string
  capabilities: string[]
}> = {
  ceo: {
    label: 'CEO',
    title: 'Chief Executive Officer',
    model: 'Opus',
    modelId: 'claude-opus-4-6',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    taskType: 'pivot_analysis',
    heartbeat: 'Once daily (09:00 UTC)',
    description: 'Strategy, pivot decisions, overall direction',
    capabilities: ['Strategic decisions', 'Pivot evaluation', 'Team management', 'Business direction'],
  },
  cto: {
    label: 'CTO',
    title: 'Chief Technology Officer',
    model: 'Sonnet',
    modelId: 'claude-sonnet-4-6',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    taskType: 'mvp_spec',
    heartbeat: 'Once daily (21:00 UTC)',
    description: 'Technical implementation, architecture, MVP specs',
    capabilities: ['Technical architecture', 'Site building', 'Code generation', 'Infrastructure'],
  },
  cmo: {
    label: 'CMO',
    title: 'Chief Marketing Officer',
    model: 'Sonnet',
    modelId: 'claude-sonnet-4-6',
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
    taskType: 'market_research',
    heartbeat: 'Once daily (21:00 UTC)',
    description: 'SEO strategy, content production, market research',
    capabilities: ['SEO strategy', 'Content production', 'Social media', 'Landing pages'],
  },
  coo: {
    label: 'COO',
    title: 'Chief Operating Officer',
    model: 'Sonnet',
    modelId: 'claude-sonnet-4-6',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    taskType: 'ops_review',
    heartbeat: 'Once daily (21:00 UTC)',
    description: 'Operations, deployment, monitoring, process optimization',
    capabilities: ['Deployment', 'Environment setup', 'Monitoring', 'Operations'],
  },
  cfo: {
    label: 'CFO',
    title: 'Chief Financial Officer',
    model: 'Sonnet',
    modelId: 'claude-sonnet-4-6',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    taskType: 'budget_review',
    heartbeat: 'Once daily (21:00 UTC)',
    description: 'Financial analysis, budget management, ROI calculation, pricing strategy',
    capabilities: ['Budget tracking', 'Cost analysis', 'ROI calculation', 'Pricing strategy'],
  },
}

async function getAgentData(role: string) {
  const profile = AGENT_PROFILES[role]
  if (!profile) return null

  try {
    const supabase = createServiceClient()
    const [runsRes, startupsRes] = await Promise.all([
      supabase
        .from('agent_runs')
        .select('*')
        .eq('task_type', profile.taskType)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('startups').select('id, name, business_type'),
    ])

    const runs = runsRes.data ?? []
    const startups = startupsRes.data ?? []
    const startupMap = Object.fromEntries(startups.map((s: { id: string; name: string; business_type: string | null }) => [s.id, s]))

    const totalCost = runs.reduce((sum: number, r: { cost_usd?: number | null }) => sum + Number(r.cost_usd || 0), 0)
    const avgCost = runs.length > 0 ? totalCost / runs.length : 0

    // 直近7日間のデータでグラフ描画
    const now = Date.now()
    const dayBuckets: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      dayBuckets[key] = 0
    }
    runs.forEach((r: { created_at: string; cost_usd?: number | null }) => {
      const day = r.created_at.slice(0, 10)
      if (day in dayBuckets) {
        dayBuckets[day] += Number(r.cost_usd || 0)
      }
    })

    return { profile, runs, startupMap, totalCost, avgCost, dayBuckets }
  } catch {
    return null
  }
}


export default async function AgentDetailPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  const data = await getAgentData(role.toLowerCase())

  if (!data) notFound()

  const { profile, runs, startupMap, totalCost, avgCost, dayBuckets } = data
  const maxDayCost = Math.max(...Object.values(dayBuckets), 0.01)

  return (
    <div className="flex flex-col min-h-0 overflow-auto">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-[#1c1c22] shrink-0">
        <Link href="/dashboard" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
          ← Mission Control
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: profile.bgColor, color: profile.color }}
          >
            {profile.label}
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">{profile.title}</h1>
            <p className="text-[12px] text-zinc-500 mt-0.5">{profile.description}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
              Active
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5">
        {/* プロファイル情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoCard label="Model" value={profile.model} detail={profile.modelId} />
          <InfoCard label="Heartbeat" value={profile.heartbeat.split(' ')[0]} detail={profile.heartbeat.split(' ').slice(1).join(' ')} />
          <InfoCard label="Total Runs" value={runs.length.toString()} detail={`avg $${avgCost.toFixed(4)}`} />
          <InfoCard label="Total Cost" value={`$${totalCost.toFixed(2)}`} detail="all time" />
        </div>

        {/* コストグラフ（直近7日） */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold">Cost Over Time</h2>
            <span className="text-[10px] text-zinc-600 font-mono">Last 7 days</span>
          </div>
          <div className="flex items-end gap-2 h-24">
            {Object.entries(dayBuckets).map(([date, cost]) => {
              const heightPct = (cost / maxDayCost) * 100
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max(heightPct, 2)}%`,
                        backgroundColor: cost > 0 ? profile.color : '#27272a',
                        opacity: cost > 0 ? 0.8 : 0.3,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-700 font-mono">
                    {date.slice(5)}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    ${cost.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Capabilities */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold mb-3">Capabilities</h2>
          <div className="flex flex-wrap gap-2">
            {profile.capabilities.map((cap) => (
              <span
                key={cap}
                className="text-[11px] px-2.5 py-1 rounded-md border"
                style={{
                  backgroundColor: profile.bgColor,
                  color: profile.color,
                  borderColor: profile.color + '30',
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Run履歴 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold">Run History</h2>
            <span className="text-[10px] text-zinc-600 font-mono">{runs.length} runs</span>
          </div>
          {runs.length === 0 ? (
            <p className="text-[12px] text-zinc-600">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run: { id: string; startup_id?: string | null; cost_usd?: number | null; created_at: string; result?: string | null }, i: number) => {
                const startup = run.startup_id ? startupMap[run.startup_id] : null
                const resultPreview = typeof run.result === 'string'
                  ? run.result.slice(0, 200).replace(/\n/g, ' ')
                  : ''
                return (
                  <details
                    key={run.id}
                    className="group border border-[#1c1c22] rounded-lg overflow-hidden hover:border-[#27272a] transition-colors"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <summary className="px-3 py-2.5 cursor-pointer hover:bg-zinc-900/50 flex items-center gap-3 list-none">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: profile.color }}
                      />
                      <span className="text-[12px] text-zinc-300 font-medium">
                        {startup?.name || 'Portfolio-wide'}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        ${Number(run.cost_usd).toFixed(4)}
                      </span>
                      <span className="ml-auto text-[10px] text-zinc-600 font-mono">
                        {timeAgo(run.created_at)}
                      </span>
                      <svg className="w-3 h-3 text-zinc-700 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </summary>
                    <div className="px-3 py-3 border-t border-[#1c1c22] bg-zinc-950/50">
                      {resultPreview ? (
                        <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-auto">
                          {run.result}
                        </pre>
                      ) : (
                        <p className="text-[11px] text-zinc-600">No result captured.</p>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[18px] font-semibold tracking-tight">{value}</p>
      {detail && <p className="text-[10px] text-zinc-600 mt-1 font-mono truncate">{detail}</p>}
    </div>
  )
}
