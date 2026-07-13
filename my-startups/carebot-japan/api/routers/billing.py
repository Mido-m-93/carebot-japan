# apps/api/routers/billing.py
"""
Stripe billing endpoints.

POST /billing/create-checkout-session — start a Pro (¥7,500/mo) or Enterprise (¥15,000/mo) checkout
POST /billing/webhook                 — Stripe signed webhook (raw body required)
GET  /billing/subscription            — current subscription status for the caller's clinic
GET  /billing/plans                   — public plan pricing, read live from Stripe (unauthenticated)

Required environment variables:
    STRIPE_SECRET_KEY          — Stripe secret key (sk_live_... or sk_test_...)
    STRIPE_WEBHOOK_SECRET      — Stripe webhook signing secret (whsec_...)
    STRIPE_PRICE_ID            — Stripe Price ID for the ¥7,500/month Pro plan (price_...)
    STRIPE_ENTERPRISE_PRICE_ID — Stripe Price ID for the ¥15,000/month Enterprise plan (price_...)
    NEXT_PUBLIC_APP_URL        — frontend URL used for success/cancel redirects
"""

import os
import stripe

from fastapi import APIRouter, Request, HTTPException, Header
from pydantic import BaseModel
from typing import Annotated, Literal

from services.db import get_db
from services.auth import resolve_clinic
from services.quota import appointments_this_month, STARTER_MONTHLY_LIMIT

router = APIRouter()

# ── Stripe client initialisation ──────────────────────────────────────────────

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

_WEBHOOK_SECRET      = os.getenv("STRIPE_WEBHOOK_SECRET", "")
_APP_URL             = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
_PRICE_IDS = {
    "pro":        os.getenv("STRIPE_PRICE_ID", ""),
    "enterprise": os.getenv("STRIPE_ENTERPRISE_PRICE_ID", ""),
}


def _resolve_billing_clinic(authorization: str | None, x_clinic_id: str | None) -> tuple[str, dict]:
    """
    Resolve the caller's active clinic, then redirect to its PARENT if it's a
    location -- billing/subscription/Stripe-customer state always lives on the
    primary clinic, never on a location (see migrations/add_clinic_locations.sql).
    Without this, a location's checkout/portal calls would create a Stripe
    customer orphaned from the real subscription.
    """
    clinic_id, clinic = resolve_clinic(authorization, x_clinic_id)
    parent_id = clinic.get("parent_clinic_id")
    if not parent_id:
        return clinic_id, clinic

    rows = get_db().table("clinics").select("*").eq("id", parent_id).limit(1).execute()
    if not rows.data:
        return clinic_id, clinic  # shouldn't happen; fall back defensively
    parent = rows.data[0]
    return parent["id"], parent


# ── POST /billing/create-checkout-session ─────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: Literal["pro", "enterprise"] = "pro"


@router.post("/create-checkout-session")
def create_checkout_session(
    body: CheckoutRequest = CheckoutRequest(),
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Create a Stripe Checkout session for the Pro or Enterprise plan.

    1. Validates the caller's Supabase JWT.
    2. Creates (or reuses) a Stripe Customer tied to this clinic.
    3. Returns a Checkout session URL the frontend redirects to.
    """
    clinic_id, clinic = _resolve_billing_clinic(authorization, x_clinic_id)

    price_id = _PRICE_IDS[body.plan]

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY not configured")
    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price not configured for plan '{body.plan}'")

    # Reuse an existing Stripe customer if we already have one
    customer_id: str | None = clinic.get("stripe_customer_id")

    try:
        if not customer_id:
            # idempotency_key ties this creation to the clinic itself, so two
            # concurrent requests that both see stripe_customer_id as null
            # (e.g. a double-click, or a retry racing the original request)
            # are deduped by Stripe into the same Customer object instead of
            # creating two orphaned customers for one clinic.
            customer = stripe.Customer.create(
                name=clinic.get("name", ""),
                metadata={"clinic_id": clinic_id},
                idempotency_key=f"clinic-customer-{clinic_id}",
            )
            customer_id = customer.id

            # Persist immediately so we don't create duplicates on retries
            get_db().table("clinics").update(
                {"stripe_customer_id": customer_id}
            ).eq("id", clinic_id).execute()

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{_APP_URL}/dashboard?billing=success",
            cancel_url=f"{_APP_URL}/dashboard?billing=cancelled",
            metadata={"clinic_id": clinic_id, "plan": body.plan},
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=502, detail="Payment system temporarily unavailable, please try again"
        ) from exc

    return {"url": session.url, "session_id": session.id}


# ── POST /billing/webhook ─────────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint.  Must receive the *raw* request body so that the
    HMAC signature computed by Stripe can be verified against it unchanged.

    Security: we ALWAYS verify the Stripe-Signature header before touching the
    payload.  An attacker who cannot forge this header cannot trigger billing
    state changes — even if they know the endpoint URL.

    Handled events
    --------------
    checkout.session.completed   → mark clinic as Pro, store customer/sub IDs
    customer.subscription.deleted → downgrade to Starter, mark cancelled
    invoice.payment_failed        → mark subscription as past_due
    """
    # ── 1. Read the raw bytes BEFORE any parsing ──────────────────────────────
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not _WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET not configured")

    # ── 2. Verify signature — this is the critical security gate ─────────────
    #    stripe.Webhook.construct_event() computes an HMAC-SHA256 over the raw
    #    payload using the webhook signing secret and compares it (constant-time)
    #    to the value in the Stripe-Signature header.  If it doesn't match, the
    #    request was not sent by Stripe and we reject it immediately.
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=_WEBHOOK_SECRET,
        )
    except stripe.SignatureVerificationError:
        # Reject loudly — this is either a replay or a forged request
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook parse error: {exc}")

    # ── 3. Dispatch on event type ─────────────────────────────────────────────
    event_type = event["type"]
    data_obj   = event["data"]["object"]

    db = get_db()

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, data_obj)

    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(db, data_obj)

    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(db, data_obj)

    # Acknowledge all other events so Stripe doesn't retry them
    return {"received": True}


def _handle_checkout_completed(db, session: dict):
    """
    checkout.session.completed — the customer just paid.
    Upgrade the clinic to whichever plan they checked out for and record
    the Stripe IDs.
    """
    customer_id     = session.get("customer")
    subscription_id = session.get("subscription")
    metadata        = session.get("metadata") or {}
    clinic_id       = metadata.get("clinic_id")
    tier            = metadata.get("plan") if metadata.get("plan") in ("pro", "enterprise") else "pro"

    if not clinic_id:
        # Fall back to looking up by customer ID if metadata is missing.
        # .limit(1), not .single()/.maybe_single() — on this postgrest
        # version, those raise instead of returning data=None for zero
        # rows, which would crash this webhook handler on an unknown
        # customer instead of just skipping it.
        rows = (
            db.table("clinics")
            .select("id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
        )
        if not rows.data:
            return  # Unknown customer — nothing to update
        clinic_id = rows.data[0]["id"]

    db.table("clinics").update({
        "stripe_customer_id":    customer_id,
        "stripe_subscription_id": subscription_id,
        "tier":                  tier,
        "subscription_status":   "active",
    }).eq("id", clinic_id).execute()


def _handle_subscription_deleted(db, subscription: dict):
    """
    customer.subscription.deleted — subscription was cancelled or expired.
    Downgrade the clinic back to Starter.
    """
    subscription_id = subscription.get("id")
    customer_id     = subscription.get("customer")

    # Prefer lookup by subscription ID; fall back to customer ID
    rows = db.table("clinics").select("id").eq("stripe_subscription_id", subscription_id).limit(1).execute()

    if not rows.data and customer_id:
        rows = (
            db.table("clinics")
            .select("id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
        )

    if not rows.data:
        return  # Nothing to update

    db.table("clinics").update({
        "tier":                "starter",
        "subscription_status": "cancelled",
    }).eq("id", rows.data[0]["id"]).execute()


def _handle_payment_failed(db, invoice: dict):
    """
    invoice.payment_failed — a renewal charge failed.
    Mark the subscription as past_due so the frontend can prompt the user.
    """
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    db.table("clinics").update({
        "subscription_status": "past_due",
    }).eq("stripe_customer_id", customer_id).execute()


# ── POST /billing/create-portal-session ──────────────────────────────────────

@router.post("/create-portal-session")
def create_portal_session(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Create a Stripe Billing Portal session so the customer can manage their
    subscription (update card, cancel, download invoices, etc.).

    Returns a one-time URL that expires after a few minutes.
    """
    clinic_id, clinic = _resolve_billing_clinic(authorization, x_clinic_id)

    customer_id: str | None = clinic.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found for this clinic")

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY not configured")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{_APP_URL}/dashboard/billing",
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=502, detail="Payment system temporarily unavailable, please try again"
        ) from exc

    return {"url": session.url}


# ── GET /billing/subscription ─────────────────────────────────────────────────

@router.get("/subscription")
def get_subscription(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Return the current billing / subscription status for the authenticated clinic.
    If the caller's active clinic is a location, this reflects its PARENT's
    billing state -- locations don't have their own subscription.

    Response fields
    ---------------
    clinic_id                — UUID of the clinic (the parent's, if a location is active)
    tier                      — 'starter' | 'pro' | 'enterprise'
    subscription_status       — 'inactive' | 'active' | 'past_due' | 'cancelled'
    stripe_customer_id        — Stripe customer ID (or None)
    stripe_subscription_id    — Stripe subscription ID (or None)
    appointments_this_month   — Starter only; None for pro/enterprise (unlimited)
    monthly_limit             — Starter only; None for pro/enterprise (unlimited)
    """
    clinic_id, clinic = _resolve_billing_clinic(authorization, x_clinic_id)
    tier = clinic.get("tier", "starter")
    is_starter = tier == "starter"

    return {
        "clinic_id":               clinic_id,
        "tier":                    tier,
        "subscription_status":     clinic.get("subscription_status", "inactive"),
        "stripe_customer_id":      clinic.get("stripe_customer_id"),
        "stripe_subscription_id": clinic.get("stripe_subscription_id"),
        "appointments_this_month": appointments_this_month(clinic_id) if is_starter else None,
        "monthly_limit":           STARTER_MONTHLY_LIMIT if is_starter else None,
    }


# ── GET /billing/plans ────────────────────────────────────────────────────────

@router.get("/plans")
def get_plans():
    """
    Public plan pricing, read live from Stripe.  Unauthenticated -- this is
    the same pricing shown to anonymous visitors on the marketing site, and
    keeping it live means the frontend never has to hardcode a yen amount
    that can silently drift out of sync with the actual configured Stripe
    Price (which is what happened before this endpoint existed).

    Note on currency formatting: JPY is a zero-decimal currency in Stripe, so
    `unit_amount` is already the whole yen amount (e.g. 7500 means literally
    ¥7,500) -- unlike USD/EUR/etc. where unit_amount is in cents. Do not
    divide by 100 when displaying this value.
    See: https://stripe.com/docs/currencies#zero-decimal

    Response
    --------
    {
      "pro":        {"unit_amount": 7500, "currency": "jpy"} | null,
      "enterprise": {"unit_amount": 15000, "currency": "jpy"} | null,
    }
    A null value means that plan's price could not be resolved (unset env
    var, misconfigured Stripe key, or a transient Stripe error) -- callers
    should fall back to their own hardcoded copy in that case.
    """
    plans: dict[str, dict | None] = {}

    for plan, price_id in _PRICE_IDS.items():
        if not stripe.api_key or not price_id:
            plans[plan] = None
            continue
        try:
            price = stripe.Price.retrieve(price_id)
            plans[plan] = {"unit_amount": price["unit_amount"], "currency": price["currency"]}
        except stripe.StripeError:
            plans[plan] = None

    return plans
