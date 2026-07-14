# apps/api/tests/test_billing.py
"""
Tests for routers/billing.py.

Focus areas (see the launch-readiness audit that flagged billing.py as having
zero test coverage): owner-only authorization on the mutating endpoints,
Stripe error handling (never a raw 500 leaking to the client), the
idempotency key on customer creation, and the webhook signature gate.
"""
from unittest.mock import MagicMock, patch

import stripe


# ── POST /billing/create-checkout-session ─────────────────────────────────────

class TestCreateCheckoutSession:
    def test_requires_auth(self, client):
        res = client.post("/billing/create-checkout-session", json={"plan": "pro"})
        assert res.status_code == 401

    def test_non_owner_is_forbidden(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(role="staff", token="staff-token")
        res = client.post(
            "/billing/create-checkout-session",
            json={"plan": "pro"},
            headers={"Authorization": "Bearer staff-token"},
        )
        assert res.status_code == 403
        assert "owner" in res.json()["detail"].lower()

    def test_missing_stripe_secret_key(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(token="owner-token")
        with patch.object(billing.stripe, "api_key", ""):
            res = client.post(
                "/billing/create-checkout-session",
                json={"plan": "pro"},
                headers={"Authorization": "Bearer owner-token"},
            )
        assert res.status_code == 500
        assert "STRIPE_SECRET_KEY" in res.json()["detail"]

    def test_missing_price_id_for_plan(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(token="owner-token")
        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "", "enterprise": ""}):
            res = client.post(
                "/billing/create-checkout-session",
                json={"plan": "pro"},
                headers={"Authorization": "Bearer owner-token"},
            )
        assert res.status_code == 500
        assert "not configured" in res.json()["detail"]

    def test_creates_customer_with_idempotency_key_when_none_exists(
        self, client, seed_clinic, billing_app
    ):
        _app, billing = billing_app
        clinic_id, token = seed_clinic(token="owner-token")

        fake_customer = MagicMock(id="cus_new123")
        fake_session = MagicMock(url="https://checkout.stripe.com/xyz", id="cs_test_1")

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "price_pro_test", "enterprise": "price_ent_test"}), \
             patch.object(billing.stripe.Customer, "create", return_value=fake_customer) as create_customer, \
             patch.object(billing.stripe.checkout.Session, "create", return_value=fake_session):
            res = client.post(
                "/billing/create-checkout-session",
                json={"plan": "pro"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert res.json() == {"url": "https://checkout.stripe.com/xyz", "session_id": "cs_test_1"}

        create_customer.assert_called_once()
        assert create_customer.call_args.kwargs["idempotency_key"] == f"clinic-customer-{clinic_id}"

    def test_reuses_existing_stripe_customer(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(token="owner-token", stripe_customer_id="cus_existing")

        fake_session = MagicMock(url="https://checkout.stripe.com/xyz", id="cs_test_2")

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "price_pro_test", "enterprise": "price_ent_test"}), \
             patch.object(billing.stripe.Customer, "create") as create_customer, \
             patch.object(billing.stripe.checkout.Session, "create", return_value=fake_session) as create_session:
            res = client.post(
                "/billing/create-checkout-session",
                json={"plan": "pro"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        create_customer.assert_not_called()
        create_session.assert_called_once()
        assert create_session.call_args.kwargs["customer"] == "cus_existing"

    def test_stripe_error_becomes_502_not_raw_500(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(token="owner-token", stripe_customer_id="cus_existing")

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "price_pro_test", "enterprise": "price_ent_test"}), \
             patch.object(
                 billing.stripe.checkout.Session, "create",
                 side_effect=stripe.StripeError("network down"),
             ):
            res = client.post(
                "/billing/create-checkout-session",
                json={"plan": "pro"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 502

    def test_location_billing_resolves_to_parent_clinic(self, client, fake_db, billing_app):
        """
        A location (child clinic) has no billing of its own -- checkout must
        be created against the PARENT clinic's Stripe customer, never the
        location's, per _resolve_billing_clinic's docstring.
        """
        _app, billing = billing_app
        fake_db.rows["clinics"] = [
            {"id": "parent-1", "name": "Parent Clinic", "tier": "enterprise",
             "stripe_customer_id": "cus_parent", "parent_clinic_id": None},
            {"id": "location-1", "name": "Location Clinic", "tier": "enterprise",
             "stripe_customer_id": None, "parent_clinic_id": "parent-1"},
        ]
        fake_db.rows["clinic_users"] = [
            {"clinic_id": "location-1", "user_id": "user-1", "role": "owner"},
        ]
        fake_db.auth.register_token("owner-token", "user-1")

        fake_session = MagicMock(url="https://checkout.stripe.com/parent", id="cs_test_3")

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "price_pro_test", "enterprise": "price_ent_test"}), \
             patch.object(billing.stripe.checkout.Session, "create", return_value=fake_session) as create_session:
            res = client.post(
                "/billing/create-checkout-session",
                json={"plan": "enterprise"},
                headers={"Authorization": "Bearer owner-token", "X-Clinic-Id": "location-1"},
            )

        assert res.status_code == 200
        assert create_session.call_args.kwargs["customer"] == "cus_parent"
        assert create_session.call_args.kwargs["metadata"]["clinic_id"] == "parent-1"


# ── POST /billing/create-portal-session ────────────────────────────────────────

class TestCreatePortalSession:
    def test_non_owner_is_forbidden(self, client, seed_clinic):
        seed_clinic(role="staff", token="staff-token", stripe_customer_id="cus_1")
        res = client.post(
            "/billing/create-portal-session",
            headers={"Authorization": "Bearer staff-token"},
        )
        assert res.status_code == 403

    def test_no_stripe_customer_yet(self, client, seed_clinic):
        seed_clinic(token="owner-token", stripe_customer_id=None)
        res = client.post(
            "/billing/create-portal-session",
            headers={"Authorization": "Bearer owner-token"},
        )
        assert res.status_code == 400

    def test_success(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(token="owner-token", stripe_customer_id="cus_1")
        fake_session = MagicMock(url="https://billing.stripe.com/portal/xyz")

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.object(billing.stripe.billing_portal.Session, "create", return_value=fake_session):
            res = client.post(
                "/billing/create-portal-session",
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert res.json() == {"url": "https://billing.stripe.com/portal/xyz"}

    def test_stripe_error_becomes_502(self, client, seed_clinic, billing_app):
        _app, billing = billing_app
        seed_clinic(token="owner-token", stripe_customer_id="cus_1")

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.object(
                 billing.stripe.billing_portal.Session, "create",
                 side_effect=stripe.StripeError("network down"),
             ):
            res = client.post(
                "/billing/create-portal-session",
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 502


# ── GET /billing/subscription ──────────────────────────────────────────────────

class TestGetSubscription:
    def test_staff_can_view_but_not_manage(self, client, seed_clinic):
        """Viewing subscription status is intentionally NOT owner-gated -- only
        the mutating checkout/portal endpoints are."""
        seed_clinic(role="staff", token="staff-token", tier="pro", subscription_status="active")
        res = client.get(
            "/billing/subscription",
            headers={"Authorization": "Bearer staff-token"},
        )
        assert res.status_code == 200
        assert res.json()["tier"] == "pro"


# ── GET /billing/plans ──────────────────────────────────────────────────────────

class TestGetPlans:
    def test_returns_live_prices(self, client, billing_app):
        _app, billing = billing_app
        fake_pro_price = {"unit_amount": 7500, "currency": "jpy"}
        fake_ent_price = {"unit_amount": 15000, "currency": "jpy"}

        def fake_retrieve(price_id):
            return {"price_pro_test": fake_pro_price, "price_ent_test": fake_ent_price}[price_id]

        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "price_pro_test", "enterprise": "price_ent_test"}), \
             patch.object(billing.stripe.Price, "retrieve", side_effect=fake_retrieve):
            res = client.get("/billing/plans")

        assert res.status_code == 200
        assert res.json() == {"pro": fake_pro_price, "enterprise": fake_ent_price}

    def test_unset_price_id_returns_null_for_that_plan(self, client, billing_app):
        _app, billing = billing_app
        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "", "enterprise": "price_ent_test"}), \
             patch.object(billing.stripe.Price, "retrieve", return_value={"unit_amount": 15000, "currency": "jpy"}):
            res = client.get("/billing/plans")

        assert res.status_code == 200
        assert res.json()["pro"] is None
        assert res.json()["enterprise"] is not None

    def test_stripe_error_returns_null_not_500(self, client, billing_app):
        _app, billing = billing_app
        with patch.object(billing.stripe, "api_key", "sk_test_fake"), \
             patch.dict(billing._PRICE_IDS, {"pro": "price_pro_test", "enterprise": "price_ent_test"}), \
             patch.object(billing.stripe.Price, "retrieve", side_effect=stripe.StripeError("down")):
            res = client.get("/billing/plans")

        assert res.status_code == 200
        assert res.json() == {"pro": None, "enterprise": None}


# ── POST /billing/webhook ────────────────────────────────────────────────────────

class TestStripeWebhook:
    def test_missing_webhook_secret_config(self, client, billing_app):
        _app, billing = billing_app
        with patch.object(billing, "_WEBHOOK_SECRET", ""):
            res = client.post(
                "/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "irrelevant"},
            )
        assert res.status_code == 500

    def test_invalid_signature_is_rejected(self, client, billing_app):
        _app, billing = billing_app
        with patch.object(billing, "_WEBHOOK_SECRET", "whsec_test"), \
             patch.object(
                 billing.stripe.Webhook, "construct_event",
                 side_effect=stripe.SignatureVerificationError("bad sig", "sig_header"),
             ):
            res = client.post(
                "/billing/webhook",
                content=b'{"type": "checkout.session.completed"}',
                headers={"stripe-signature": "forged"},
            )
        assert res.status_code == 400
        assert "signature" in res.json()["detail"].lower()

    def test_checkout_completed_upgrades_clinic(self, client, fake_db, billing_app):
        _app, billing = billing_app
        fake_db.rows["clinics"] = [
            {"id": "clinic-1", "tier": "starter", "subscription_status": "inactive",
             "stripe_customer_id": None, "stripe_subscription_id": None},
        ]
        event = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "customer": "cus_123",
                "subscription": "sub_123",
                "metadata": {"clinic_id": "clinic-1", "plan": "enterprise"},
            }},
        }
        with patch.object(billing, "_WEBHOOK_SECRET", "whsec_test"), \
             patch.object(billing.stripe.Webhook, "construct_event", return_value=event):
            res = client.post(
                "/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )

        assert res.status_code == 200
        clinic = fake_db.rows["clinics"][0]
        assert clinic["tier"] == "enterprise"
        assert clinic["subscription_status"] == "active"
        assert clinic["stripe_customer_id"] == "cus_123"
        assert clinic["stripe_subscription_id"] == "sub_123"

    def test_subscription_deleted_downgrades_to_starter(self, client, fake_db, billing_app):
        _app, billing = billing_app
        fake_db.rows["clinics"] = [
            {"id": "clinic-1", "tier": "pro", "subscription_status": "active",
             "stripe_subscription_id": "sub_123", "stripe_customer_id": "cus_123"},
        ]
        event = {
            "type": "customer.subscription.deleted",
            "data": {"object": {"id": "sub_123", "customer": "cus_123"}},
        }
        with patch.object(billing, "_WEBHOOK_SECRET", "whsec_test"), \
             patch.object(billing.stripe.Webhook, "construct_event", return_value=event):
            res = client.post(
                "/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )

        assert res.status_code == 200
        clinic = fake_db.rows["clinics"][0]
        assert clinic["tier"] == "starter"
        assert clinic["subscription_status"] == "cancelled"

    def test_payment_failed_marks_past_due(self, client, fake_db, billing_app):
        _app, billing = billing_app
        fake_db.rows["clinics"] = [
            {"id": "clinic-1", "tier": "pro", "subscription_status": "active",
             "stripe_customer_id": "cus_123"},
        ]
        event = {
            "type": "invoice.payment_failed",
            "data": {"object": {"customer": "cus_123"}},
        }
        with patch.object(billing, "_WEBHOOK_SECRET", "whsec_test"), \
             patch.object(billing.stripe.Webhook, "construct_event", return_value=event):
            res = client.post(
                "/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["subscription_status"] == "past_due"

    def test_unknown_customer_on_checkout_completed_is_ignored_not_500(self, client, fake_db, billing_app):
        """No clinic_id in metadata AND no clinic matches the customer ID --
        should just no-op, never crash the webhook (Stripe would retry
        forever on a 500)."""
        _app, billing = billing_app
        fake_db.rows["clinics"] = []
        event = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "customer": "cus_unknown",
                "subscription": "sub_unknown",
                "metadata": {},
            }},
        }
        with patch.object(billing, "_WEBHOOK_SECRET", "whsec_test"), \
             patch.object(billing.stripe.Webhook, "construct_event", return_value=event):
            res = client.post(
                "/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )

        assert res.status_code == 200
