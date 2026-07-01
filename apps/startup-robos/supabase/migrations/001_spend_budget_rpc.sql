-- Atomic budget spend function.
-- Avoids read-modify-write race conditions by doing a single UPDATE
-- that both increments spent_usd AND checks the budget limit in one statement.
--
-- Returns the updated row if the spend succeeded, or no rows if budget is exceeded.

CREATE OR REPLACE FUNCTION spend_budget(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS TABLE (
  new_spent  numeric,
  total      numeric,
  remaining  numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE token_budgets
  SET    spent_usd  = spent_usd + p_amount,
         updated_at = now()
  WHERE  user_id    = p_user_id
    AND  spent_usd + p_amount <= total_usd
  RETURNING
    spent_usd           AS new_spent,
    total_usd           AS total,
    total_usd - spent_usd AS remaining;
$$;

-- Also create a budget check function that doesn't mutate
CREATE OR REPLACE FUNCTION check_budget(p_user_id uuid)
RETURNS TABLE (
  spent  numeric,
  total  numeric,
  remaining numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    spent_usd       AS spent,
    total_usd       AS total,
    total_usd - spent_usd AS remaining
  FROM token_budgets
  WHERE user_id = p_user_id;
$$;
