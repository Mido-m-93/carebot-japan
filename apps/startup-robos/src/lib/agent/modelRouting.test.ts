import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTierForTask, getModelForTask } from './modelRouting'

function makeSupabase(model: string | null, error = false): SupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(
            error
              ? { data: null, error: { message: 'DB error' } }
              : { data: model ? { model } : null, error: null }
          ),
        })),
      })),
    })),
  } as unknown as SupabaseClient
}

describe('getTierForTask', () => {
  it('cxo_ceo は high', () => {
    expect(getTierForTask('cxo_ceo')).toBe('high')
  })

  it('ceo_review は high', () => {
    expect(getTierForTask('ceo_review')).toBe('high')
  })

  it('pivot_decision は high', () => {
    expect(getTierForTask('pivot_decision')).toBe('high')
  })

  it('market_research は low', () => {
    expect(getTierForTask('market_research')).toBe('low')
  })

  it('未知のタスクは low', () => {
    expect(getTierForTask('unknown_task')).toBe('low')
  })
})

describe('getModelForTask', () => {
  it('DB からモデルを取得する', async () => {
    const supabase = makeSupabase('qwen/qwen-3.6')
    const model = await getModelForTask('market_research', supabase)
    expect(model).toBe('qwen/qwen-3.6')
  })

  it('high tier タスクは high tier のモデルを取得する', async () => {
    const supabase = makeSupabase('z-ai/glm-5.1')
    const model = await getModelForTask('cxo_ceo', supabase)
    expect(model).toBe('z-ai/glm-5.1')
  })

  it('DB エラー時はデフォルトにフォールバック', async () => {
    const supabase = makeSupabase(null, true)
    const model = await getModelForTask('market_research', supabase)
    expect(model).toBe('deepseek/deepseek-v4-flash')
  })

  it('DB が空行を返した場合もデフォルトにフォールバック', async () => {
    const supabase = makeSupabase(null)
    const model = await getModelForTask('cxo_ceo', supabase)
    expect(model).toBe('moonshotai/kimi-k2.6')
  })

  it('fetch が throw した場合もデフォルトにフォールバック', async () => {
    const supabase = {
      from: vi.fn(() => { throw new Error('Network failure') }),
    } as unknown as SupabaseClient
    const model = await getModelForTask('market_research', supabase)
    expect(model).toBe('deepseek/deepseek-v4-flash')
  })
})
