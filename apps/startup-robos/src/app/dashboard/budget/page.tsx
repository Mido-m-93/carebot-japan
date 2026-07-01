export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/server'

interface RunRow {
  id: string
  startup_id: string | null
  cost_usd: number | null
  model: string | null
  task_type: string | null
  created_at: string | null
}

interface StartupRow {
  id: string
  name: string
}

async function getBudgetData() {
  try {
    const supabase = createServiceClient()
    const [runsRes, startupsRes] = await Promise.all([
      supabase.from('agent_runs').select('id, startup_id, cost_usd, model, task_type, created_at').order('created_at', { ascending: false }),
      supabase.from('startups').select('id, name'),
    ])

    const runs = (runsRes.data ?? []) as RunRow[]
    const startups = (startupsRes.data ?? []) as StartupRow[]

    const startupMap = new Map(startups.map((s) => [s.id, s.name]))

    const totalSpend = runs.reduce((sum, r) => sum + Number(r.cost_usd || 0), 0)

    // Per-startup cost aggregation
    const perStartup = new Map<string, { name: string; cost: number; runs: number }>()
    for (const r of runs) {
      const sid = r.startup_id ?? 'unassigned'
      const existing = perStartup.get(sid) ?? { name: startupMap.get(sid) ?? 'Unassigned', cost: 0, runs: 0 }
      existing.cost += Number(r.cost_usd || 0)
      existing.runs += 1
      perStartup.set(sid, existing)
    }

    const perStartupList = Array.from(perStartup.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.cost - a.cost)

    return { runs, totalSpend, perStartupList, totalRuns: runs.length }
  } catch {
    return { runs: [], totalSpend: 0, perStartupList: [], totalRuns: 0 }
  }
}

export default async function BudgetPage() {
  const { totalSpend, perStartupList, totalRuns } = await getBudgetData()

  return (
    <div className="flex flex-col min-h-0 overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1c1c22] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Budget</h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">AI spend across all startups</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-600 font-mono">
          <span>{totalRuns} runs</span>
          <span className="text-zinc-700">|</span>
          <span>${totalSpend.toFixed(4)} total</span>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Total Spend</p>
            <p className="text-[20px] font-semibold tracking-tight text-orange-400">${totalSpend.toFixed(4)}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Agent Runs</p>
            <p className="text-[20px] font-semibold tracking-tight text-blue-400">{totalRuns}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Avg Cost / Run</p>
            <p className="text-[20px] font-semibold tracking-tight text-green-400">
              ${totalRuns > 0 ? (totalSpend / totalRuns).toFixed(4) : '0.0000'}
            </p>
          </div>
        </div>

        {/* Per-startup cost table */}
        <div className="card">
          <div className="px-4 py-3 border-b border-[#1c1c22]">
            <h2 className="text-[12px] font-semibold tracking-tight">Cost by Startup</h2>
          </div>
          {perStartupList.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[12px] text-zinc-600">No agent runs recorded yet</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] text-zinc-600 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold">Startup</th>
                  <th className="text-right px-4 py-2 font-semibold">Runs</th>
                  <th className="text-right px-4 py-2 font-semibold">Cost</th>
                  <th className="text-right px-4 py-2 font-semibold">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {perStartupList.map((s) => (
                  <tr key={s.id} className="border-t border-[#1c1c22]">
                    <td className="px-4 py-2.5 text-zinc-300">{s.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{s.runs}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-300">${s.cost.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-500">
                      {totalSpend > 0 ? ((s.cost / totalSpend) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
