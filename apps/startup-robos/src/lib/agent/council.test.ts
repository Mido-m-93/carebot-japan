import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BudgetExhaustedError } from '@/lib/agent/budgetDeduction'

vi.mock('@/lib/agent/llm', () => ({
  callLLM: vi.fn(),
}))
vi.mock('@/lib/agent/modelRouting', () => ({
  getModelForTask: vi.fn().mockResolvedValue('deepseek/deepseek-v4-flash'),
}))

import { runCouncil } from './council'

function makeSupabase(budgetRow: { spent_usd: number; total_usd: number } | null): SupabaseClient {
  const remaining = budgetRow ? budgetRow.total_usd - budgetRow.spent_usd : 0
  return {
    rpc: vi.fn().mockResolvedValue({
      data: budgetRow ? [{ remaining }] : null,
      error: budgetRow === null ? { message: 'not found' } : null,
    }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: budgetRow, error: null }),
        })),
      })),
    })),
  } as unknown as SupabaseClient
}

describe('runCouncil — pre-flight budget check', () => {
  it('throws BudgetExhaustedError when remaining is below MIN_BUDGET_USD', async () => {
    const supabase = makeSupabase({ spent_usd: 9.95, total_usd: 10.0 })
    await expect(
      runCouncil('user-abc', 'startup-xyz', 'context', 'agenda', supabase)
    ).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws BudgetExhaustedError when budget is fully exhausted', async () => {
    const supabase = makeSupabase({ spent_usd: 10.0, total_usd: 10.0 })
    await expect(
      runCouncil('user-abc', 'startup-xyz', 'context', 'agenda', supabase)
    ).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws generic Error when budget row is not found', async () => {
    const supabase = makeSupabase(null)
    await expect(
      runCouncil('user-abc', 'startup-xyz', 'context', 'agenda', supabase)
    ).rejects.toThrow('Budget information not found')
    await expect(
      runCouncil('user-abc', 'startup-xyz', 'context', 'agenda', supabase)
    ).rejects.not.toThrow(BudgetExhaustedError)
  })
})
