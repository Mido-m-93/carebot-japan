# apps/api/tests/conftest.py
"""
Shared fixtures for the API test suite.

Everything here is a lightweight in-memory fake of the two external
dependencies every router leans on: the Supabase client (services.db.get_db)
and Stripe. Real network calls never happen in this suite.
"""
import sys
import os
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Tests run with cwd=api/ in CI, but be defensive about sys.path so this also
# works when pytest is invoked from the repo root.
API_ROOT = Path(__file__).resolve().parent.parent
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

# services/db.py reads these at import time (module-level get_db() singleton);
# set them before any app module is imported so create_client() is never
# actually reached (get_db is monkeypatched everywhere it's used anyway, but
# this avoids a KeyError if some import path evaluates it eagerly).
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


class FakeResponse:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if data else 0


class FakeQuery:
    def __init__(self, table, op, payload=None):
        self.table = table
        self.op = op  # "select" | "insert" | "update" | "delete"
        self.payload = payload
        self.filters = []  # list of (kind, field, value)
        self.order_by = None  # (field, desc)

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters.append(("eq", field, value))
        return self

    def in_(self, field, values):
        self.filters.append(("in", field, values))
        return self

    def gte(self, field, value):
        self.filters.append(("gte", field, value))
        return self

    def lte(self, field, value):
        self.filters.append(("lte", field, value))
        return self

    def limit(self, n):
        self.filters.append(("limit", None, n))
        return self

    def order(self, field, desc=False):
        self.order_by = (field, desc)
        return self

    def execute(self):
        return self.table.db._execute(self)


class FakeTable:
    def __init__(self, db, name):
        self.db = db
        self.name = name

    def select(self, *_cols):
        return FakeQuery(self, "select")

    def insert(self, row):
        return FakeQuery(self, "insert", payload=dict(row))

    def update(self, values):
        return FakeQuery(self, "update", payload=dict(values))

    def delete(self):
        return FakeQuery(self, "delete")


class FakeUser:
    def __init__(self, id):
        self.id = id


class FakeUserResponse:
    def __init__(self, user):
        self.user = user


class FakeAuth:
    def __init__(self):
        self._tokens: dict[str, str] = {}

    def register_token(self, token: str, user_id: str) -> None:
        self._tokens[token] = user_id

    def get_user(self, token):
        user_id = self._tokens.get(token)
        if user_id is None:
            raise Exception("Invalid token")
        return FakeUserResponse(FakeUser(user_id))


class FakeDB:
    """
    In-memory stand-in for the Supabase client. Seed `db.rows["clinics"]` /
    `db.rows["clinic_users"]` etc. directly with plain dicts; supports the
    select/insert/update/delete + eq/in_/limit chain used throughout the app.
    """

    def __init__(self):
        self.rows: dict[str, list[dict]] = {}
        self.auth = FakeAuth()

    def table(self, name: str) -> FakeTable:
        return FakeTable(self, name)

    def _execute(self, query: FakeQuery) -> FakeResponse:
        rows = self.rows.setdefault(query.table.name, [])

        if query.op == "select":
            result = rows
            limit_value = None
            for kind, field, value in query.filters:
                if kind == "eq":
                    result = [r for r in result if r.get(field) == value]
                elif kind == "in":
                    result = [r for r in result if r.get(field) in value]
                elif kind == "gte":
                    result = [r for r in result if r.get(field) is not None and r[field] >= value]
                elif kind == "lte":
                    result = [r for r in result if r.get(field) is not None and r[field] <= value]
                elif kind == "limit":
                    limit_value = value
            if query.order_by:
                order_field, desc = query.order_by
                result = sorted(result, key=lambda r: (r.get(order_field) is None, r.get(order_field)), reverse=desc)
            if limit_value is not None:
                result = result[:limit_value]
            return FakeResponse(list(result))

        if query.op == "insert":
            new_row = dict(query.payload)
            new_row.setdefault("id", f"generated-{query.table.name}-{len(rows)}")
            rows.append(new_row)
            return FakeResponse([new_row])

        if query.op == "update":
            matched = rows
            for kind, field, value in query.filters:
                if kind == "eq":
                    matched = [r for r in matched if r.get(field) == value]
            for r in matched:
                r.update(query.payload)
            return FakeResponse(list(matched))

        if query.op == "delete":
            matched = rows
            for kind, field, value in query.filters:
                if kind == "eq":
                    matched = [r for r in matched if r.get(field) == value]
            for r in matched:
                rows.remove(r)
            return FakeResponse(list(matched))

        raise NotImplementedError(query.op)


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def seed_clinic(fake_db):
    """
    Seed one clinic + one clinic_users row for a given user, and register a
    bearer token for that user in the fake auth. Returns (clinic_id, token).
    """
    def _seed(clinic_id="clinic-1", user_id="user-1", role="owner", token="test-token", **clinic_overrides):
        clinic = {
            "id": clinic_id,
            "name": "Test Clinic",
            "tier": "starter",
            "subscription_status": "inactive",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "parent_clinic_id": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
        clinic.update(clinic_overrides)
        fake_db.rows.setdefault("clinics", []).append(clinic)
        fake_db.rows.setdefault("clinic_users", []).append(
            {"clinic_id": clinic_id, "user_id": user_id, "role": role}
        )
        fake_db.auth.register_token(token, user_id)
        return clinic_id, token

    return _seed


@pytest.fixture
def billing_app(monkeypatch, fake_db):
    """
    A FastAPI app containing only the billing router, with services.db.get_db
    patched (both where it's defined and everywhere it's already been
    imported by name) to return our fake DB.
    """
    import services.db as db_module
    import services.auth as auth_module
    import routers.billing as billing_module

    monkeypatch.setattr(db_module, "get_db", lambda: fake_db)
    monkeypatch.setattr(auth_module, "get_db", lambda: fake_db)
    monkeypatch.setattr(billing_module, "get_db", lambda: fake_db)

    app = FastAPI()
    app.include_router(billing_module.router, prefix="/billing")
    return app, billing_module


@pytest.fixture
def client(billing_app):
    app, _billing_module = billing_app
    return TestClient(app)
