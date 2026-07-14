# apps/api/tests/test_health.py
"""
Tests for GET /health -- it's what any uptime monitor will poll, so it needs
to actually reflect whether the app can reach its dependencies, not just
"the process is running".
"""
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def health_client(monkeypatch, fake_db):
    import main as main_module

    monkeypatch.setattr(main_module, "get_db", lambda: fake_db)
    return TestClient(main_module.app), main_module


class TestHealth:
    def test_healthy_when_db_reachable_and_config_present(self, health_client):
        client, main_module = health_client
        required = {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-key",
            "STRIPE_SECRET_KEY": "sk_test_fake",
            "STRIPE_WEBHOOK_SECRET": "whsec_fake",
        }
        with patch.dict(main_module.os.environ, required):
            res = client.get("/health")

        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["checks"]["database"] == "ok"
        assert body["checks"]["config"] == "ok"

    def test_degraded_when_db_unreachable(self, health_client, fake_db, monkeypatch):
        client, main_module = health_client

        def _raise_connection_error(_name):
            raise Exception("connection refused")

        monkeypatch.setattr(fake_db, "table", _raise_connection_error)

        required = {
            "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-key",
            "STRIPE_SECRET_KEY": "sk_test_fake",
            "STRIPE_WEBHOOK_SECRET": "whsec_fake",
        }
        with patch.dict(main_module.os.environ, required):
            res = client.get("/health")

        assert res.status_code == 503
        body = res.json()
        assert body["status"] == "degraded"
        assert "error" in body["checks"]["database"]

    def test_degraded_when_required_config_missing(self, health_client, monkeypatch):
        client, main_module = health_client

        with patch.dict(main_module.os.environ, {}, clear=False):
            monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
            monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
            monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
            monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
            res = client.get("/health")

        assert res.status_code == 503
        body = res.json()
        assert body["status"] == "degraded"
        assert "STRIPE_SECRET_KEY" in body["checks"]["config"]
