import { API_URL } from "@/lib/supabase";

export interface PlanPrice {
  unit_amount: number;
  currency: string;
}

export interface PlansResponse {
  pro: PlanPrice | null;
  enterprise: PlanPrice | null;
}

const EMPTY_PLANS: PlansResponse = { pro: null, enterprise: null };

/**
 * Fetch live plan pricing from the backend (GET /billing/plans), which reads
 * the real Stripe Price objects instead of relying on hardcoded copy that
 * can drift out of sync if the Stripe price ever changes.
 *
 * Unauthenticated -- pricing is public information. Returns null for any
 * plan that couldn't be resolved (missing config, Stripe error, or the
 * fetch itself failing) so callers can fall back to their own hardcoded
 * strings.
 */
export async function fetchPlans(): Promise<PlansResponse> {
  try {
    const res = await fetch(`${API_URL}/billing/plans`);
    if (!res.ok) return EMPTY_PLANS;
    const data = await res.json();
    return {
      pro: data?.pro ?? null,
      enterprise: data?.enterprise ?? null,
    };
  } catch {
    return EMPTY_PLANS;
  }
}

/**
 * Format a Stripe Price's unit_amount/currency for display.
 *
 * IMPORTANT: for most currencies Stripe's `unit_amount` is in the smallest
 * unit (e.g. cents for USD), but JPY is a "zero-decimal" currency, so
 * `unit_amount` is already the whole yen amount -- 7500 means literally
 * ¥7,500, not ¥75.00. See https://stripe.com/docs/currencies#zero-decimal.
 * `Intl.NumberFormat` already knows JPY has 0 fraction digits, so formatting
 * `unit_amount` directly (no /100) produces the correct result.
 */
export function formatPlanPrice(price: PlanPrice | null, locale: string): string | null {
  if (!price || typeof price.unit_amount !== "number" || !price.currency) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: price.currency.toUpperCase(),
    }).format(price.unit_amount);
  } catch {
    return null;
  }
}
