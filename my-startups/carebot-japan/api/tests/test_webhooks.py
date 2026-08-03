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

import routers.webhooks as webhooks


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
