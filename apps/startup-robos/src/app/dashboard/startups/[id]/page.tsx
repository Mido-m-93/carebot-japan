export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/server'

interface StartupRow {
  id: string
  name: string
  description: string | null
  status: string
  business_type: string | null
  experiment_count: number | null
  max_experiments: number | null
  created_at: string | null
}

interface RunRow {
  id: string
  model: string
  task_type: string | null
  cost_usd: number | null
  tokens_input: number | null
  tokens_output: number | null
  created_at: string | null
}

interface ExperimentRow {
  id: string
  hypothesis: string
  metric: string
  target_value: string | null
  status: string
  result: string | null
  created_at: string | null
}

async function getStartupDetail(id: string) {
  try {
    const supabase = createServiceClient()
    const [startupRes, runsRes, experimentsRes] = await Promise.all([
      supabase.from('startups').select('*').eq('id', id).single(),
      supabase.from('agent_runs').select('id, model, task_type, cost_usd, tokens_input, tokens_output, created_at').eq('startup_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('experiments').select('*').eq('startup_id', id).order('created_at', { ascending: false }),
    ])

    return {
      startup: (startupRes.data as StartupRow) ?? null,
      runs: (runsRes.data ?? []) as RunRow[],
      experiments: (experimentsRes.data ?? []) as ExperimentRow[],
    }
  } catch {
    return { startup: null, runs: [], experiments: [] }
  }
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  pivoted: 'bg-orange-500/10 text-orange-400',
  paused: 'bg-zinc-800 text-zinc-500',
  graduated: 'bg-blue-500/10 text-blue-400',
  pending: 'bg-zinc-800 text-zinc-500',
  running: 'bg-blue-500/10 text-blue-400',
  success: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
}

export default async function StartupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { startup, runs, experiments } = await getStartupDetail(id)

  if (!startup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-[13px] text-zinc-600">Startup not found</p>
      </div>
    )
  }

  const totalCost = runs.reduce((sum, r) => sum + Number(r.cost_usd || 0), 0)

  return (
    <div className="flex flex-col min-h-0 overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1c1c22] shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-[15px] font-semibold tracking-tight">{startup.name}</h1>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[startup.status] ?? 'bg-zinc-800 text-zinc-500'}`}>
            {startup.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-600">
          {startup.business_type && <span className="font-mono">{startup.business_type}</span>}
          {startup.description && (
            <>
              <span className="text-zinc-700">|</span>
              <span>{startup.description}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Experiments</p>
            <p className="text-[20px] font-semibold tracking-tight text-purple-400">{experiments.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Successful</p>
            <p className="text-[20px] font-semibold tracking-tight text-green-400">
              {experiments.filter((e) => e.status === 'success').length}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Agent Runs</p>
            <p className="text-[20px] font-semibold tracking-tight text-blue-400">{runs.length}</p>
            <p className="text-[10px] text-zinc-600 mt-1">last 10</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-1">Cost</p>
            <p className="text-[20px] font-semibold tracking-tight text-orange-400">${totalCost.toFixed(4)}</p>
            <p className="text-[10px] text-zinc-600 mt-1">last 10 runs</p>
          </div>
        </div>

        {/* Recent Agent Runs */}
        <div className="card">
          <div className="px-4 py-3 border-b border-[#1c1c22]">
            <h2 className="text-[12px] font-semibold tracking-tight">Recent Agent Runs</h2>
          </div>
          {runs.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[12px] text-zinc-600">No agent runs yet</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] text-zinc-600 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold">Model</th>
                  <th className="text-left px-4 py-2 font-semibold">Task</th>
                  <th className="text-right px-4 py-2 font-semibold">Tokens</th>
                  <th className="text-right px-4 py-2 font-semibold">Cost</th>
                  <th className="text-right px-4 py-2 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-[#1c1c22]">
                    <td className="px-4 py-2.5 font-mono text-zinc-300">{r.model}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{r.task_type ?? '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-500">
                      {r.tokens_input != null || r.tokens_output != null
                        ? `${r.tokens_input ?? 0} / ${r.tokens_output ?? 0}`
                        : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                      ${Number(r.cost_usd || 0).toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-500">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Experiments */}
        <div className="card">
          <div className="px-4 py-3 border-b border-[#1c1c22]">
            <h2 className="text-[12px] font-semibold tracking-tight">Experiments</h2>
          </div>
          {experiments.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[12px] text-zinc-600">No experiments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1c1c22]">
              {experiments.map((e) => (
                <div key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-zinc-300">{e.hypothesis}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-zinc-500 font-mono">{e.metric}</span>
                        {e.target_value && (
                          <>
                            <span className="text-zinc-700 text-[10px]">/</span>
                            <span className="text-[10px] text-zinc-500 font-mono">target: {e.target_value}</span>
                          </>
                        )}
                      </div>
                      {e.result && (
                        <p className="text-[11px] text-zinc-500 mt-1">{e.result}</p>
                      )}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_STYLE[e.status] ?? 'bg-zinc-800 text-zinc-500'}`}>
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
