import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deductBudget, checkBudgetPreFlight, BudgetExhaustedError } from './budgetDeduction'

// Supabase クライアントのモックファクトリー
function makeSupabase(rpcResult: { data: unknown; error: unknown }): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as SupabaseClient
}

describe('deductBudget', () => {
  it('RPC が行を返した場合 { ok: true, remaining } を返す', async () => {
    const supabase = makeSupabase({ data: [{ new_spent: 10, total: 510, remaining: 500 }], error: null })

    const result = await deductBudget(supabase, 'user-123', 10)

    expect(result).toEqual({ ok: true, remaining: 500 })
    expect(supabase.rpc).toHaveBeenCalledWith('spend_budget', {
      p_user_id: 'user-123',
      p_amount: 10,
    })
  })

  it('RPC が空配列を返した場合（残量不足）{ ok: false, remaining: null } を返す', async () => {
    const supabase = makeSupabase({ data: [], error: null })

    const result = await deductBudget(supabase, 'user-456', 9999)

    expect(result).toEqual({ ok: false, remaining: null })
  })

  it('RPC がエラーを返した場合 throw する', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'DB connection failed' } })

    await expect(deductBudget(supabase, 'user-789', 5)).rejects.toThrow('DB connection failed')
  })

  it('負の cost を拒否する', async () => {
    const supabase = makeSupabase({ data: [], error: null })
    await expect(deductBudget(supabase, 'user-001', -10)).rejects.toThrow('cost must be a positive number')
  })

  it('ゼロの cost を拒否する', async () => {
    const supabase = makeSupabase({ data: [], error: null })
    await expect(deductBudget(supabase, 'user-001', 0)).rejects.toThrow('cost must be a positive number')
  })
})

describe('checkBudgetPreFlight', () => {
  it('resolves when budget is sufficient (remaining > minUsd)', async () => {
    const supabase = makeSupabase({ data: [{ remaining: 5.00 }], error: null })
    await expect(checkBudgetPreFlight(supabase, 'user-1')).resolves.toBeUndefined()
  })

  it('throws BudgetExhaustedError when remaining is 0 (default minUsd=0)', async () => {
    const supabase = makeSupabase({ data: [{ remaining: 0 }], error: null })
    await expect(checkBudgetPreFlight(supabase, 'user-1')).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws BudgetExhaustedError when remaining is below minUsd threshold', async () => {
    const supabase = makeSupabase({ data: [{ remaining: 0.05 }], error: null })
    await expect(checkBudgetPreFlight(supabase, 'user-1', 0.10)).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws BudgetExhaustedError at exact boundary (remaining === minUsd)', async () => {
    const supabase = makeSupabase({ data: [{ remaining: 0.10 }], error: null })
    await expect(checkBudgetPreFlight(supabase, 'user-1', 0.10)).rejects.toThrow(BudgetExhaustedError)
  })

  it('throws generic Error when RPC returns error', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'connection failed' } })
    await expect(checkBudgetPreFlight(supabase, 'user-1')).rejects.toThrow('Budget information not found')
    await expect(checkBudgetPreFlight(supabase, 'user-1')).rejects.not.toThrow(BudgetExhaustedError)
  })

  it('throws generic Error when RPC returns empty data', async () => {
    const supabase = makeSupabase({ data: [], error: null })
    await expect(checkBudgetPreFlight(supabase, 'user-1')).rejects.toThrow('Budget information not found')
  })
})

describe('BudgetExhaustedError', () => {
  it('Error のサブクラスであり instanceof で判別できる', () => {
    const err = new BudgetExhaustedError('budget gone')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(BudgetExhaustedError)
    expect(err.message).toBe('budget gone')
    expect(err.name).toBe('BudgetExhaustedError')
  })
})
