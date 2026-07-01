# apps/api/routers/billing.py
"""
Stripe billing endpoints.

POST /billing/create-checkout-session — start a $49/month Pro checkout
POST /billing/webhook                 — Stripe signed webhook (raw body required)
GET  /billing/subscription            — current subscription status for the caller's clinic

Required environment variables:
    STRIPE_SECRET_KEY        — Stripe secret key (sk_live_... or sk_test_...)
    STRIPE_WEBHOOK_SECRET    — Stripe webhook signing secret (whsec_...)
    STRIPE_PRICE_ID          — Stripe Price ID for the $49/month plan (price_...)
    NEXT_PUBLIC_APP_URL      — frontend URL used for success/cancel redirects
    SUPABASE_JWT_SECRET      — Supabase JWT secret (used to validate Bearer tokens)
"""

import os
import stripe
import jwt as pyjwt

from fastapi import APIRouter, Request, HTTPException, Header
from typing import Annotated

from services.db import get_db

router = APIRouter()

# ── Stripe client initialisation ──────────────────────────────────────────────

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
_PRICE_ID       = os.getenv("STRIPE_PRICE_ID", "")
_APP_URL        = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _decode_jwt(token: str) -> dict:
    """
    Validate a Supabase-issued JWT and return its payload.
    Raises HTTP 401 on any validation failure.
    """
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")
    try:
        payload = pyjwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


def _get_clinic_id_for_user(user_id: str) -> str:
    """
    Look up the clinic that this Supabase user belongs to.
    Expects a `clinic_users` table with (clinic_id, user_id) columns.
    Raises HTTP 404 if no mapping exists.
    """
    db = get_db()
    row = (
        db.table("clinic_users")
        .select("clinic_id")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="No clinic found for this user")
    return row.data["clinic_id"]


def _resolve_clinic(authorization: str | None) -> tuple[str, dict]:
    """
    Parse the Bearer token from the Authorization header, validate it,
    and return (clinic_id, clinic_row).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token   = authorization.removeprefix("Bearer ").strip()
    payload = _decode_jwt(token)
    user_id = payload["sub"]

    clinic_id = _get_clinic_id_for_user(user_id)

    db  = get_db()
    row = db.table("clinics").select("*").eq("id", clinic_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Clinic not found")

    return clinic_id, row.data


# ── POST /billing/create-checkout-session ─────────────────────────────────────

@router.post("/create-checkout-session")
def create_checkout_session(
    authorization: Annotated[str | None, Header()] = None,
):
    """
    Create a Stripe Checkout session for the $49/month Pro plan.

    1. Validates the caller's Supabase JWT.
    2. Creates (or reuses) a Stripe Customer tied to this clinic.
    3. Returns a Checkout session URL the frontend redirects to.
    """
    clinic_id, clinic = _resolve_clinic(authorization)

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY not configured")
    if not _PRICE_ID:
        raise HTTPException(status_code=500, detail="STRIPE_PRICE_ID not configured")

    # Reuse an existing Stripe customer if we already have one
    customer_id: str | None = clinic.get("stripe_customer_id")

    if not customer_id:
        customer = stripe.Customer.create(
            name=clinic.get("name", ""),
            metadata={"clinic_id": clinic_id},
        )
        customer_id = customer.id

        # Persist immediately so we don't create duplicates on retries
        get_db().table("clinics").update(
            {"stripe_customer_id": customer_id}
        ).eq("id", clinic_id).execute()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": _PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=f"{_APP_URL}/dashboard?billing=success",
        cancel_url=f"{_APP_URL}/dashboard?billing=cancelled",
        metadata={"clinic_id": clinic_id},
    )

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
    Upgrade the clinic to Pro and record the Stripe IDs.
    """
    customer_id     = session.get("customer")
    subscription_id = session.get("subscription")
    clinic_id       = (session.get("metadata") or {}).get("clinic_id")

    if not clinic_id:
        # Fall back to looking up by customer ID if metadata is missing
        row = (
            db.table("clinics")
            .select("id")
            .eq("stripe_customer_id", customer_id)
            .single()
            .execute()
        )
        if not row.data:
            return  # Unknown customer — nothing to update
        clinic_id = row.data["id"]

    db.table("clinics").update({
        "stripe_customer_id":    customer_id,
        "stripe_subscription_id": subscription_id,
        "tier":                  "pro",
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
    query = db.table("clinics").select("id").eq("stripe_subscription_id", subscription_id)
    row   = query.single().execute()

    if not row.data and customer_id:
        row = (
            db.table("clinics")
            .select("id")
            .eq("stripe_customer_id", customer_id)
            .single()
            .execute()
        )

    if not row.data:
        return  # Nothing to update

    db.table("clinics").update({
        "tier":                "starter",
        "subscription_status": "cancelled",
    }).eq("id", row.data["id"]).execute()


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
):
    """
    Create a Stripe Billing Portal session so the customer can manage their
    subscription (update card, cancel, download invoices, etc.).

    Returns a one-time URL that expires after a few minutes.
    """
    clinic_id, clinic = _resolve_clinic(authorization)

    customer_id: str | None = clinic.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found for this clinic")

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY not configured")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{_APP_URL}/dashboard/billing",
    )

    return {"url": session.url}


# ── GET /billing/subscription ─────────────────────────────────────────────────

@router.get("/subscription")
def get_subscription(
    authorization: Annotated[str | None, Header()] = None,
):
    """
    Return the current billing / subscription status for the authenticated clinic.

    Response fields
    ---------------
    clinic_id            — UUID of the clinic
    tier                 — 'starter' | 'pro' | 'enterprise'
    subscription_status  — 'inactive' | 'active' | 'past_due' | 'cancelled'
    stripe_customer_id   — Stripe customer ID (or None)
    stripe_subscription_id — Stripe subscription ID (or None)
    """
    clinic_id, clinic = _resolve_clinic(authorization)

    return {
        "clinic_id":              clinic_id,
        "tier":                   clinic.get("tier", "starter"),
        "subscription_status":    clinic.get("subscription_status", "inactive"),
        "stripe_customer_id":     clinic.get("stripe_customer_id"),
        "stripe_subscription_id": clinic.get("stripe_subscription_id"),
    }
