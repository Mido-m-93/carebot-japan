# apps/api/tests/test_webhooks.py
"""
Tests for the per-clinic LINE credential resolution added to
routers/webhooks.py -- signature verification and replies must use a
clinic's own line_channel_secret / line_channel_access_token when it has
configured them, and fall back to the global LINE_CHANNEL_SECRET /
LINE_CHANNEL_ACCESS_TOKEN env vars otherwise (the original single-tenant
clinic never configured its own).
"""
import hashlib
import hmac
import base64
from unittest.mock import patch

import routers.webhooks as webhooks

CLINIC_ID = "clinic-1"


def _sign(secret: str, body: bytes) -> str:
    return base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()


class TestResolveClinicByLineChannel:
    def test_returns_none_for_empty_channel_id(self):
        assert webhooks._resolve_clinic_by_line_channel("") is None

    def test_returns_none_when_no_clinic_matches(self, fake_db, monkeypatch):
        monkeypatch.setattr(webhooks, "get_db", lambda: fake_db)
        fake_db.rows["clinics"] = []
        assert webhooks._resolve_clinic_by_line_channel("unknown-channel") is None

    def test_returns_clinic_row_with_credentials(self, fake_db, monkeypatch):
        monkeypatch.setattr(webhooks, "get_db", lambda: fake_db)
        fake_db.rows["clinics"] = [{
            "id": "clinic-1",
            "line_channel_id": "channel-abc",
            "line_channel_secret": "clinic-secret",
            "line_channel_access_token": "clinic-token",
        }]
        result = webhooks._resolve_clinic_by_line_channel("channel-abc")
        assert result["id"] == "clinic-1"
        assert result["line_channel_secret"] == "clinic-secret"
        assert result["line_channel_access_token"] == "clinic-token"


class TestVerifyLineSignature:
    def test_uses_clinic_secret_when_provided(self):
        body = b'{"destination": "channel-abc"}'
        signature = _sign("clinic-secret", body)
        assert webhooks._verify_line_signature(body, signature, secret="clinic-secret") is True

    def test_clinic_secret_mismatch_is_rejected_even_if_it_matches_global(self, monkeypatch):
        monkeypatch.setenv("LINE_CHANNEL_SECRET", "global-secret")
        body = b'{"destination": "channel-abc"}'
        signature = _sign("global-secret", body)
        # Signed with the global secret, but a clinic secret was resolved --
        # must NOT silently fall back to the global one once a clinic secret exists.
        assert webhooks._verify_line_signature(body, signature, secret="clinic-secret") is False

    def test_falls_back_to_global_secret_when_no_clinic_secret(self, monkeypatch):
        monkeypatch.setenv("LINE_CHANNEL_SECRET", "global-secret")
        body = b'{"destination": "unregistered"}'
        signature = _sign("global-secret", body)
        assert webhooks._verify_line_signature(body, signature, secret=None) is True

    def test_fails_closed_when_neither_secret_is_configured(self, monkeypatch):
        monkeypatch.delenv("LINE_CHANNEL_SECRET", raising=False)
        body = b'{"destination": "unregistered"}'
        assert webhooks._verify_line_signature(body, "anything", secret=None) is False


class TestWebBookingIsTestGating:
    """
    POST /webhooks/web is unauthenticated and public (the real patient-facing
    web widget uses it too), so a client-supplied is_test=True must only be
    honored when the caller can prove they're an authenticated member of the
    target clinic -- otherwise anyone could hide real bookings from a
    clinic's own stats. Only the gating logic is under test here; the actual
    scheduling pipeline is mocked out.
    """

    def _payload(self, is_test=True):
        return {"clinic_id": CLINIC_ID, "message": "hello", "is_test": is_test}

    def test_is_test_ignored_with_no_auth_header(self, webhooks_client):
        with patch.object(webhooks, "process_message", return_value={"status": "small_talk"}) as mock_process:
            res = webhooks_client.post("/webhooks/web", json=self._payload())

        assert res.status_code == 200
        assert mock_process.call_args.kwargs["is_test"] is False

    def test_is_test_ignored_for_a_clinic_the_caller_does_not_belong_to(self, webhooks_client, seed_clinic):
        seed_clinic(clinic_id="other-clinic", token="owner-token")

        with patch.object(webhooks, "process_message", return_value={"status": "small_talk"}) as mock_process:
            res = webhooks_client.post(
                "/webhooks/web", json=self._payload(),
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert mock_process.call_args.kwargs["is_test"] is False

    def test_is_test_honored_for_an_authenticated_member_of_the_clinic(self, webhooks_client, seed_clinic):
        seed_clinic(clinic_id=CLINIC_ID, token="owner-token")

        with patch.object(webhooks, "process_message", return_value={"status": "small_talk"}) as mock_process:
            res = webhooks_client.post(
                "/webhooks/web", json=self._payload(),
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert mock_process.call_args.kwargs["is_test"] is True

    def test_is_test_false_stays_false_even_when_authenticated(self, webhooks_client, seed_clinic):
        seed_clinic(clinic_id=CLINIC_ID, token="owner-token")

        with patch.object(webhooks, "process_message", return_value={"status": "small_talk"}) as mock_process:
            res = webhooks_client.post(
                "/webhooks/web", json=self._payload(is_test=False),
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert mock_process.call_args.kwargs["is_test"] is False
