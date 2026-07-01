export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { TYPE_CONFIG, SITE_URLS } from '@/lib/startup/config'

interface StartupRow { id: string; name: string; status: string; business_type: string | null; description?: string | null }
interface ExperimentRow { id: string; startup_id: string | null; status: string }
interface RunRow { id: string; startup_id: string | null; cost_usd: number | null }

async function getStartupsWithMetrics() {
  try {
    const supabase = createServiceClient()
    const [startupsRes, experimentsRes, runsRes] = await Promise.all([
      supabase.from('startups').select('*').order('created_at'),
      supabase.from('experiments').select('id, startup_id, status'),
      supabase.from('agent_runs').select('id, startup_id, cost_usd'),
    ])

    const startups = (startupsRes.data ?? []) as StartupRow[]
    const experiments = (experimentsRes.data ?? []) as ExperimentRow[]
    const runs = (runsRes.data ?? []) as RunRow[]

    // スタートアップごとのメトリクス集計
    return startups.map((s) => {
      const sExperiments = experiments.filter((e) => e.startup_id === s.id)
      const sRuns = runs.filter((r) => r.startup_id === s.id)
      const cost = sRuns.reduce((sum: number, r) => sum + Number(r.cost_usd || 0), 0)
      return {
        ...s,
        experimentCount: sExperiments.length,
        runningExperiments: sExperiments.filter((e) => e.status === 'running').length,
        successExperiments: sExperiments.filter((e) => e.status === 'success').length,
        runCount: sRuns.length,
        cost,
      }
    })
  } catch {
    return []
  }
}

export default async function StartupsIndexPage() {
  const startups = await getStartupsWithMetrics()

  const totalCost = startups.reduce((sum, s) => sum + s.cost, 0)
  const totalRuns = startups.reduce((sum, s) => sum + s.runCount, 0)
  const totalExperiments = startups.reduce((sum, s) => sum + s.experimentCount, 0)

  return (
    <div className="flex flex-col min-h-0 overflow-auto">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-[#1c1c22] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Startups</h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">All businesses in autonomous operation</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-600 font-mono">
          <span>{startups.length} projects</span>
          <span className="text-zinc-700">|</span>
          <span>{totalRuns} runs</span>
          <span className="text-zinc-700">|</span>
          <span>${totalCost.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5">
        {/* 集計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Projects"
            value={startups.length.toString()}
            sub="all active"
            color="purple"
          />
          <SummaryCard
            label="Experiments"
            value={totalExperiments.toString()}
            sub={`${startups.filter((s) => s.runningExperiments > 0).length} with running`}
            color="blue"
          />
          <SummaryCard
            label="Agent Runs"
            value={totalRuns.toString()}
            sub="cumulative"
            color="green"
          />
          <SummaryCard
            label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
            sub="all projects"
            color="orange"
          />
        </div>

        {/* プロジェクトカードグリッド */}
        {startups.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[12px] text-zinc-600">No projects yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {startups.map((s, i) => {
              const typeConfig = (s.business_type && TYPE_CONFIG[s.business_type]) || {
                label: s.business_type ?? 'unknown',
                color: '#6b7280',
                bg: 'rgba(107, 114, 128, 0.1)',
              }
              const siteUrl = SITE_URLS[s.name]
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/startups/${s.id}`}
                  className="card p-4 hover:border-[#27272a] transition-all group"
                  style={{
                    animation: 'fadeIn 0.3s ease-out both',
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {/* ヘッダー行 */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold tracking-tight group-hover:text-white transition-colors truncate">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}
                        >
                          {typeConfig.label}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            s.status === 'active'
                              ? 'bg-green-500/10 text-green-400'
                              : s.status === 'pivoted'
                                ? 'bg-orange-500/10 text-orange-400'
                                : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {s.description && (
                    <p className="text-[11px] text-zinc-500 mb-3 line-clamp-2">{s.description}</p>
                  )}

                  {/* メトリクス */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1c1c22]">
                    <MetricMini label="Exps" value={s.experimentCount.toString()} sub={s.runningExperiments > 0 ? `${s.runningExperiments} running` : undefined} />
                    <MetricMini label="Runs" value={s.runCount.toString()} />
                    <MetricMini label="Cost" value={`$${s.cost.toFixed(2)}`} />
                  </div>

                  {/* サイトURL表示（ここではクリック不可、詳細ページから開く） */}
                  {siteUrl && (
                    <div className="mt-3 pt-3 border-t border-[#1c1c22]">
                      <p className="text-[10px] text-zinc-600 flex items-center gap-1 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 shrink-0" />
                        <span className="truncate">{siteUrl.replace('https://', '')}</span>
                      </p>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: 'green' | 'blue' | 'purple' | 'orange'
}) {
  const colorMap = {
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    orange: '#f97316',
  }
  return (
    <div className="card p-4">
      <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[20px] font-semibold tracking-tight" style={{ color: colorMap[color] }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

function MetricMini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
      <p className="text-[12px] text-zinc-300 font-semibold mt-0.5">{value}</p>
      {sub && <p className="text-[8px] text-zinc-700 mt-0.5">{sub}</p>}
    </div>
  )
}
