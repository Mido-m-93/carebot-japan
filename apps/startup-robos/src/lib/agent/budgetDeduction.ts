// アトミックなトークン予算控除
// Postgres RPC `spend_budget` を呼び出し、TOCTOU 競合を排除する
//
// 成功: { ok: true, remaining: number }
// 残量不足（RPC が空行を返した場合）: { ok: false, remaining: null }
// Supabase エラー: throw

import type { SupabaseClient } from '@supabase/supabase-js'

export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExhaustedError'
  }
}

/**
 * Pre-flight budget check via Postgres RPC.
 * Throws BudgetExhaustedError if remaining < minUsd (default 0).
 * Throws generic Error if the budget row is not found.
 */
export async function checkBudgetPreFlight(
  supabase: SupabaseClient,
  userId: string,
  minUsd = 0,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_budget', { p_user_id: userId })

  if (error || !data?.length) throw new Error('Budget information not found')

  const remaining = Number(data[0].remaining)
  if (remaining <= minUsd) {
    throw new BudgetExhaustedError(
      'Your token budget for this cycle has been used up. Please wait for the next billing cycle or contact the operator to increase your budget.'
    )
  }
}

export async function deductBudget(
  supabase: SupabaseClient,
  userId: string,
  cost: number
): Promise<{ ok: boolean; remaining: number | null }> {
  if (cost <= 0) throw new Error('cost must be a positive number')

  const { data, error } = await supabase.rpc('spend_budget', {
    p_user_id: userId,
    p_amount: cost,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!Array.isArray(data) || data.length === 0) {
    // 残量不足: UPDATE の WHERE 条件不一致で行が返らない
    return { ok: false, remaining: null }
  }

  return { ok: true, remaining: Number(data[0].remaining) }
}
