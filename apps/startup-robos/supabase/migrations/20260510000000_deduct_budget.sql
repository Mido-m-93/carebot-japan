-- アトミックなトークン予算控除 RPC
-- スキーマ: token_budgets(user_id, total_usd, spent_usd, updated_at)
-- 成功時: 控除後の残高 (total_usd - spent_usd) を返す
-- 残量不足時: NULL を返す（呼び出し側がエラー扱い）
CREATE OR REPLACE FUNCTION deduct_budget(p_user_id UUID, p_cost NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining NUMERIC;
BEGIN
  UPDATE token_budgets
    SET spent_usd  = spent_usd + p_cost,
        updated_at = NOW()
  WHERE user_id = p_user_id
    AND (total_usd - spent_usd) >= p_cost
  RETURNING (total_usd - spent_usd) INTO v_remaining;

  RETURN v_remaining; -- 更新対象行なし（残量不足）の場合は NULL
END;
$$;
