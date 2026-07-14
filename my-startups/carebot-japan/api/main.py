# apps/api/main.py
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

load_dotenv("../../.env.local")  # local dev only; Railway injects vars directly

# Error tracking -- inert until SENTRY_DSN is set (no account configured yet
# means no-op, not a crash). Must run before importing routers so exceptions
# raised during router import are captured too.
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("RAILWAY_ENVIRONMENT_NAME", "production"),
        traces_sample_rate=0.0,  # error tracking only, no perf tracing (avoid surprise cost)
    )

from routers import webhooks, appointments, queue, claims, billing, clinics, audit
from services.limiter import limiter
from services.db import get_db

app = FastAPI(
    title="CareBot Japan — Scheduling API",
    description="AI-powered clinic scheduling and claims automation",
    version="0.2.0",
)

# Rate limiting (per client IP) for the public, unauthenticated endpoints —
# see services/limiter.py and the @limiter.limit(...) decorators in the
# individual routers.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_app_url = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
_allowed_origins = [_app_url, "http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(_allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
app.include_router(queue.router, prefix="/queue", tags=["queue"])
app.include_router(claims.router, prefix="/claims", tags=["claims"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])
app.include_router(clinics.router, prefix="/clinics", tags=["clinics"])
app.include_router(audit.router, prefix="/audit-log", tags=["audit-log"])


@app.get("/health")
def health(response: Response):
    """
    Checks the two things that have actually broken production before: DB
    reachability and required config being present. Returns 503 (not 200)
    when degraded, so uptime monitors alert on status code alone rather than
    needing to parse the body.

    Deliberately does NOT call Stripe live -- this endpoint may be polled
    every minute by an external monitor, and a round-trip to a third-party
    API on every poll adds latency/cost for no real benefit over just
    checking the key is configured.
    """
    checks = {}

    try:
        get_db().table("clinics").select("id").limit(1).execute()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    required_env = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
    ]
    missing = [name for name in required_env if not os.getenv(name)]
    checks["config"] = "ok" if not missing else f"missing: {', '.join(missing)}"

    is_healthy = all(v == "ok" for v in checks.values())
    response.status_code = 200 if is_healthy else 503

    return {
        "status": "ok" if is_healthy else "degraded",
        "service": "carebot-scheduling",
        "checks": checks,
    }
