import type { SupabaseClient } from '@supabase/supabase-js'

type Tier = 'high' | 'low'

const TASK_TIER_MAP: Record<string, Tier> = {
  cxo_ceo: 'high',
  ceo_review: 'high',
  pivot_decision: 'high',
}

const DEFAULTS: Record<Tier, string> = {
  high: 'moonshotai/kimi-k2.6',
  low: 'deepseek/deepseek-v4-flash',
}

export function getTierForTask(taskType: string): Tier {
  return TASK_TIER_MAP[taskType] ?? 'low'
}

export async function getModelForTask(
  taskType: string,
  supabase: SupabaseClient,
): Promise<string> {
  const tier = getTierForTask(taskType)

  try {
    const { data, error } = await supabase
      .from('model_config')
      .select('model')
      .eq('tier', tier)
      .single()

    if (error || !data?.model) {
      console.warn(`[modelRouting] model_config fetch failed for tier=${tier}, using default`)
      return DEFAULTS[tier]
    }

    return data.model
  } catch {
    console.warn(`[modelRouting] model_config fetch exception for tier=${tier}, using default`)
    return DEFAULTS[tier]
  }
}
