# apps/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv("../../.env.local", override=True)
load_dotenv("../../.env.example")  # fallback for local dev

from routers import webhooks, appointments, queue, fax, claims

app = FastAPI(
    title="CareBot Japan — Scheduling API",
    description="AI-powered clinic scheduling, fax intake, and claims automation",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
app.include_router(queue.router, prefix="/queue", tags=["queue"])
app.include_router(fax.router, prefix="/fax", tags=["fax"])
app.include_router(claims.router, prefix="/claims", tags=["claims"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "carebot-scheduling"}
