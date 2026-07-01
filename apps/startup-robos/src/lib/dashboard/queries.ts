import { createServiceClient } from '@/lib/supabase/server'
import { TASK_AGENT } from '@/lib/agent/roles'

// --- Agent role definitions for dashboard display ---

export interface AgentRole {
  label: string
  model: string
  accent: string
}

export const AGENT_ROLES: Record<string, AgentRole> = {
  ceo: { label: 'CEO', model: 'claude-opus-4-6', accent: 'amber' },
  cto: { label: 'CTO', model: 'claude-sonnet-4-6', accent: 'blue' },
  cmo: { label: 'CMO', model: 'claude-sonnet-4-6', accent: 'pink' },
  coo: { label: 'COO', model: 'claude-sonnet-4-6', accent: 'orange' },
  cfo: { label: 'CFO', model: 'claude-sonnet-4-6', accent: 'green' },
}

// --- Helpers ---

export function agentForTaskType(taskType: string | null): string {
  if (!taskType) return 'ceo'
  return TASK_AGENT[taskType]?.role ?? 'ceo'
}

export function formatTaskType(taskType: string | null): string {
  if (!taskType) return 'Unknown'
  return TASK_AGENT[taskType]?.taskLabel ?? taskType.replace(/_/g, ' ')
}

export function formatModel(model: string | null): string {
  if (!model) return '—'
  if (model.includes('opus')) return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku')) return 'Haiku'
  return model
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// --- Data queries ---

interface AgentListItem {
  id: string
  label: string
  model: string
  accent: string
  status: 'active' | 'idle' | 'error'
  runCount: number
  totalCostUsd: number
  lastRunAt: string | null
}

export async function listAgents(): Promise<AgentListItem[]> {
  const supabase = createServiceClient()
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('task_type, cost_usd, created_at')
    .order('created_at', { ascending: false })

  const byRole: Record<string, { count: number; cost: number; lastAt: string | null }> = {}
  for (const r of runs ?? []) {
    const role = agentForTaskType(r.task_type)
    if (!byRole[role]) byRole[role] = { count: 0, cost: 0, lastAt: null }
    byRole[role].count++
    byRole[role].cost += Number(r.cost_usd ?? 0)
    if (!byRole[role].lastAt) byRole[role].lastAt = r.created_at
  }

  return Object.entries(AGENT_ROLES).map(([id, def]) => {
    const stats = byRole[id]
    return {
      id,
      label: def.label,
      model: def.model,
      accent: def.accent,
      status: stats && stats.count > 0 ? ('active' as const) : ('idle' as const),
      runCount: stats?.count ?? 0,
      totalCostUsd: stats?.cost ?? 0,
      lastRunAt: stats?.lastAt ?? null,
    }
  })
}

export interface HeartbeatRun {
  id: string
  task_type: string | null
  startup_name: string | null
  model: string | null
  cost_usd: number
  created_at: string
}

export async function listHeartbeats(limit = 100): Promise<HeartbeatRun[]> {
  const supabase = createServiceClient()
  const [runsRes, startupsRes] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('id, task_type, startup_id, model, cost_usd, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase.from('startups').select('id, name'),
  ])

  const startupMap = Object.fromEntries(
    (startupsRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
  )

  type AgentRunRow = Pick<HeartbeatRun, 'id' | 'task_type' | 'model' | 'cost_usd' | 'created_at'> & {
    startup_id: string | null
  }
  return (runsRes.data ?? []).map((r: AgentRunRow) => ({
    id: r.id,
    task_type: r.task_type,
    startup_name: r.startup_id ? startupMap[r.startup_id] ?? null : null,
    model: r.model,
    cost_usd: Number(r.cost_usd ?? 0),
    created_at: r.created_at,
  }))
}


interface DashboardOverview {
  projects: Array<{ id: string; name: string; status: string; business_type: string | null }>
  issues: Array<{ id: string; startup_id: string | null; status: string }>
  agents: AgentListItem[]
  costs: { budget: { spent_usd: number; total_usd: number } | null }
  activity: HeartbeatRun[]
  activeIssues: number
  activeAgents: number
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const supabase = createServiceClient()

  const [startupsRes, experimentsRes, budgetRes, agents, activity] = await Promise.all([
    supabase
      .from('startups')
      .select('id, name, status, business_type')
      .order('created_at'),
    supabase
      .from('experiments')
      .select('id, startup_id, status'),
    supabase
      .from('token_budgets')
      .select('spent_usd, total_usd')
      .limit(1)
      .maybeSingle(),
    listAgents(),
    listHeartbeats(20),
  ])

  const projects = (startupsRes.data ?? []) as DashboardOverview['projects']
  const issues = (experimentsRes.data ?? []) as DashboardOverview['issues']
  const activeIssues = issues.filter((i) => i.status === 'running' || i.status === 'pending').length
  const activeAgents = agents.filter((a) => a.status === 'active').length

  return {
    projects,
    issues,
    agents,
    costs: {
      budget: budgetRes.data
        ? { spent_usd: Number(budgetRes.data.spent_usd), total_usd: Number(budgetRes.data.total_usd) }
        : null,
    },
    activity,
    activeIssues,
    activeAgents,
  }
}
