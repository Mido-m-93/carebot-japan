// task_type → エージェント情報の一元管理
// 全ファイルで共通して参照する定数定義

export interface TaskAgentDef {
  /** 役職ラベル（例: 'CEO', 'CTO'） */
  label: string
  /** エージェントカラー（16進数） */
  color: string
  /** URLスラグ用ロール（例: 'ceo', 'cto'） */
  role: string
  /** タスク種別の表示名（例: 'Pivot Analysis'） */
  taskLabel: string
}

export const TASK_AGENT: Record<string, TaskAgentDef> = {
  pivot_analysis: { label: 'CEO', color: '#f59e0b', role: 'ceo', taskLabel: 'Pivot Analysis' },
  mvp_spec:       { label: 'CTO', color: '#3b82f6', role: 'cto', taskLabel: 'MVP Specification' },
  market_research:{ label: 'CMO', color: '#ec4899', role: 'cmo', taskLabel: 'Market Research' },
  ops_review:     { label: 'COO', color: '#f97316', role: 'coo', taskLabel: 'Operations Review' },
  budget_review:  { label: 'CFO', color: '#22c55e', role: 'cfo', taskLabel: 'Budget Review' },
  pivot_decision: { label: 'CEO', color: '#f59e0b', role: 'ceo', taskLabel: 'Pivot Decision' },
  ceo_review:     { label: 'CEO', color: '#f59e0b', role: 'ceo', taskLabel: 'CEO Review' },
  cto_review:     { label: 'CTO', color: '#3b82f6', role: 'cto', taskLabel: 'CTO Review' },
}
