# apps/api/routers/fax.py
"""
Fax / document intake endpoints.

POST /fax/webhook    — receives fax from eFax/Telnyx/Twilio Fax
POST /fax/test       — submit plain text as a simulated fax (dev/testing)
GET  /fax/{clinic_id} — list documents for a clinic
"""
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from services.db import get_db
from services.document_ai import extract_from_image_url, extract_from_base64, extract_from_text

router = APIRouter()

DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000001"


# ── Models ────────────────────────────────────────────────────

class FaxWebhookPayload(BaseModel):
    """Generic fax webhook payload — compatible with Telnyx and eFax formats."""
    clinic_id: str | None = None
    to_fax_number: str | None = None       # destination fax (used to resolve clinic)
    from_fax_number: str | None = None
    image_url: str | None = None           # URL to fax image (Telnyx)
    image_base64: str | None = None        # base64 image (some providers)
    media_type: str = "image/jpeg"
    pages: int = 1


class TestFaxPayload(BaseModel):
    clinic_id: str = DEMO_CLINIC_ID
    text: str
    sender_fax: str | None = None


class DocumentResponse(BaseModel):
    id: str
    source: str
    document_type: str | None
    status: str
    summary: str | None
    patient_name: str | None
    created_at: str


# ── Helpers ───────────────────────────────────────────────────

def _process_document(
    *,
    clinic_id: str,
    source: str,
    extraction: dict,
    sender_fax: str | None = None,
    original_url: str | None = None,
    pages: int = 1,
) -> str:
    """Write document record + optionally push to review queue. Returns document_id."""
    db = get_db()
    doc_id = str(uuid.uuid4())

    doc_row = {
        "id": doc_id,
        "clinic_id": clinic_id,
        "source": source,
        "file_type": "image" if original_url else "text",
        "original_url": original_url,
        "raw_text": extraction.get("raw_text"),
        "extracted_data": extraction,
        "document_type": extraction.get("document_type"),
        "sender_fax": sender_fax,
        "pages": pages,
        "status": "processed",
    }

    # Push to review queue if document type relates to scheduling or is low confidence
    needs_review = (
        extraction.get("document_type") in ("referral", "appointment_request", "other")
        or extraction.get("confidence", 1.0) < 0.75
        or bool(extraction.get("flags"))
    )

    if needs_review:
        raw_text = extraction.get("raw_text", "")
        queue_item = {
            "clinic_id": clinic_id,
            "source": "fax",
            "raw_input": raw_text[:2000],  # truncate for storage
            "intent": "appointment_request" if extraction.get("document_type") == "referral" else "general_inquiry",
            "intent_confidence": extraction.get("confidence", 0.5),
            "extracted_data": extraction,
            "field_confidences": {},
            "status": "pending",
        }
        queue_result = db.table("review_queue").insert(queue_item).execute()
        if queue_result.data:
            doc_row["review_queue_id"] = queue_result.data[0]["id"]

    db.table("documents").insert(doc_row).execute()

    db.table("audit_logs").insert({
        "clinic_id": clinic_id,
        "action": "document_received",
        "actor": "fax_service",
        "record_type": "document",
        "record_id": doc_id,
        "metadata": {
            "source": source,
            "document_type": extraction.get("document_type"),
            "confidence": extraction.get("confidence"),
            "flags": extraction.get("flags", []),
            "needs_review": needs_review,
        },
    }).execute()

    return doc_id


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/webhook")
async def fax_webhook(payload: FaxWebhookPayload, background_tasks: BackgroundTasks):
    """
    Receives fax from eFax / Telnyx / Twilio Fax.
    Returns 200 immediately; OCR runs in background.
    """
    if not payload.image_url and not payload.image_base64:
        raise HTTPException(status_code=400, detail="image_url or image_base64 required")

    # Resolve clinic from fax number if clinic_id not provided
    clinic_id = payload.clinic_id or DEMO_CLINIC_ID

    def _run():
        if payload.image_url:
            extraction = extract_from_image_url(payload.image_url, payload.media_type)
        else:
            extraction = extract_from_base64(payload.image_base64, payload.media_type)

        _process_document(
            clinic_id=clinic_id,
            source="fax",
            extraction=extraction,
            sender_fax=payload.from_fax_number,
            original_url=payload.image_url,
            pages=payload.pages,
        )

    background_tasks.add_task(_run)
    return {"status": "ok", "message": "Fax received, processing in background"}


@router.post("/test")
async def test_fax(payload: TestFaxPayload):
    """
    Submit plain text as a simulated fax — for testing without a real fax provider.
    Processes synchronously and returns the extraction result.
    """
    extraction = extract_from_text(payload.text)
    doc_id = _process_document(
        clinic_id=payload.clinic_id,
        source="fax",
        extraction=extraction,
        sender_fax=payload.sender_fax,
    )
    return {
        "status": "processed",
        "document_id": doc_id,
        "document_type": extraction.get("document_type"),
        "patient_name": extraction.get("patient_name"),
        "summary": extraction.get("summary"),
        "confidence": extraction.get("confidence"),
        "flags": extraction.get("flags", []),
        "extracted": extraction,
    }


@router.get("/{clinic_id}")
async def list_documents(clinic_id: str, status: str | None = None, limit: int = 50):
    """List documents for a clinic, optionally filtered by status."""
    db = get_db()
    query = (
        db.table("documents")
        .select("id, source, document_type, status, extracted_data, sender_fax, pages, created_at")
        .eq("clinic_id", clinic_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)

    result = query.execute()
    rows = result.data or []

    return [
        {
            "id": r["id"],
            "source": r["source"],
            "document_type": r["document_type"],
            "status": r["status"],
            "patient_name": (r.get("extracted_data") or {}).get("patient_name"),
            "summary": (r.get("extracted_data") or {}).get("summary"),
            "sender_fax": r.get("sender_fax"),
            "pages": r.get("pages", 1),
            "flags": (r.get("extracted_data") or {}).get("flags", []),
            "created_at": r["created_at"],
        }
        for r in rows
    ]
