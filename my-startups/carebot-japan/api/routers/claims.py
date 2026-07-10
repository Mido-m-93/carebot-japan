# apps/api/routers/claims.py
"""
Insurance claims workflow endpoints.

POST /claims/            — create a new claim (draft)
GET  /claims/{clinic_id} — list claims for a clinic
GET  /claims/detail/{id} — get single claim
POST /claims/{id}/submit — submit claim (triggers AI review)
POST /claims/{id}/status — update claim status (admin)
"""
import uuid
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Annotated
from services.db import get_db
from services.document_ai import review_claim
from services.auth import resolve_clinic, require_own_clinic

router = APIRouter()


# ── Models ────────────────────────────────────────────────────

class CreateClaimRequest(BaseModel):
    appointment_id: str | None = None
    document_id: str | None = None
    patient_name: str | None = None
    patient_dob: str | None = None        # "YYYY-MM-DD"
    insurer_name: str | None = None
    insurer_id: str | None = None
    policy_number: str | None = None
    procedure_codes: list[str] = []
    diagnosis_codes: list[str] = []
    amount_claimed: int | None = None     # yen
    notes: str | None = None


class UpdateStatusRequest(BaseModel):
    status: str   # 'approved' | 'rejected' | 'resubmit' | 'under_review'
    rejection_reason: str | None = None
    amount_approved: int | None = None


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/")
async def create_claim(
    payload: CreateClaimRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """Create a new claim in draft status for the caller's clinic."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    claim_id = str(uuid.uuid4())

    row = {
        "id": claim_id,
        "clinic_id": clinic_id,
        "appointment_id": payload.appointment_id,
        "document_id": payload.document_id,
        "patient_name": payload.patient_name,
        "patient_dob": payload.patient_dob,
        "insurer_name": payload.insurer_name,
        "insurer_id": payload.insurer_id,
        "policy_number": payload.policy_number,
        "procedure_codes": payload.procedure_codes,
        "diagnosis_codes": payload.diagnosis_codes,
        "amount_claimed": payload.amount_claimed,
        "notes": payload.notes,
        "status": "draft",
    }

    db.table("claims").insert(row).execute()
    _log(db, clinic_id, "claim_created", claim_id, {"status": "draft"})

    return {"status": "created", "claim_id": claim_id}


@router.get("/")
async def list_claims(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
    status: str | None = None,
    limit: int = 50,
):
    """List all claims for the caller's clinic."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    query = (
        db.table("claims")
        .select("id, patient_name, insurer_name, amount_claimed, amount_approved, status, ai_flags, submitted_at, created_at")
        .eq("clinic_id", clinic_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)

    result = query.execute()
    return result.data or []


@router.get("/detail/{claim_id}")
async def get_claim(
    claim_id: str,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """Get full claim details. Caller must own the claim's clinic."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    result = db.table("claims").select("*").eq("id", claim_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim_row = result.data[0]
    require_own_clinic(claim_row.get("clinic_id"), clinic_id, "Claim not found")
    return claim_row


@router.post("/{claim_id}/submit")
async def submit_claim(
    claim_id: str,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Submit a claim for processing.
    Runs Claude AI review first to flag any issues before submission.
    """
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    result = db.table("claims").select("*").eq("id", claim_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim = result.data[0]
    require_own_clinic(claim.get("clinic_id"), clinic_id, "Claim not found")

    if claim["status"] not in ("draft", "resubmit"):
        raise HTTPException(status_code=400, detail=f"Cannot submit claim with status '{claim['status']}'")

    # Run AI review (gracefully skip if API unavailable / no credits)
    try:
        ai_review = review_claim({
            "patient_name": claim.get("patient_name"),
            "insurer_name": claim.get("insurer_name"),
            "policy_number": claim.get("policy_number"),
            "procedure_codes": claim.get("procedure_codes", []),
            "diagnosis_codes": claim.get("diagnosis_codes", []),
            "amount_claimed": claim.get("amount_claimed"),
        })
    except Exception as e:
        ai_review = {
            "is_valid": None,
            "flags": [],
            "notes": f"AI review unavailable: {str(e)[:120]}",
            "estimated_approval_rate": None,
        }

    from datetime import datetime, timezone, timedelta
    now_jst = datetime.now(tz=timezone(timedelta(hours=9))).isoformat()

    db.table("claims").update({
        "status": "submitted",
        "submitted_at": now_jst,
        "ai_flags": ai_review,
    }).eq("id", claim_id).execute()

    _log(db, claim["clinic_id"], "claim_submitted", claim_id, {
        "ai_flags_count": len(ai_review.get("flags", [])),
        "estimated_approval_rate": ai_review.get("estimated_approval_rate"),
    })

    return {
        "status": "submitted",
        "claim_id": claim_id,
        "ai_review": ai_review,
    }


@router.post("/{claim_id}/status")
async def update_claim_status(
    claim_id: str,
    payload: UpdateStatusRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """Update claim status (used when insurer responds). Caller must own the claim's clinic."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    result = db.table("claims").select("clinic_id, status").eq("id", claim_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    require_own_clinic(result.data[0].get("clinic_id"), clinic_id, "Claim not found")

    valid = {"approved", "rejected", "resubmit", "under_review"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    from datetime import datetime, timezone, timedelta
    now_jst = datetime.now(tz=timezone(timedelta(hours=9))).isoformat()

    update = {"status": payload.status, "adjudicated_at": now_jst}
    if payload.rejection_reason:
        update["rejection_reason"] = payload.rejection_reason
    if payload.amount_approved is not None:
        update["amount_approved"] = payload.amount_approved

    db.table("claims").update(update).eq("id", claim_id).execute()
    _log(db, result.data[0]["clinic_id"], "claim_status_updated", claim_id, {"new_status": payload.status})

    return {"status": payload.status, "claim_id": claim_id}


# ── Helper ────────────────────────────────────────────────────

def _log(db, clinic_id, action, record_id, metadata=None):
    db.table("audit_logs").insert({
        "clinic_id": clinic_id,
        "action": action,
        "actor": "claims_service",
        "record_type": "claim",
        "record_id": str(record_id),
        "metadata": metadata or {},
    }).execute()
