# apps/api/services/document_ai.py
"""
Claude Vision-based document OCR and extraction.
Handles fax images, PDFs (as images), and scanned forms.
"""
import os
import json
import base64
import httpx
import anthropic

DOCUMENT_SYSTEM = """You are a Japanese medical clinic document processing assistant.
Analyze the provided document (fax, scanned form, or image) and extract all relevant information.

Return ONLY valid JSON. No commentary, no markdown. Use null for missing fields.

{
  "document_type": "referral" | "prescription" | "insurance_form" | "lab_result" | "appointment_request" | "other",
  "patient_name": null,
  "patient_dob": null,
  "referring_doctor": null,
  "clinic_name": null,
  "diagnosis": null,
  "procedures": [],
  "insurer_name": null,
  "policy_number": null,
  "requested_date": null,
  "urgency": "routine" | "urgent" | "emergency" | null,
  "raw_text": "full extracted text from the document",
  "summary": "one sentence summary in Japanese",
  "confidence": 0.0,
  "flags": []
}

For Japanese medical documents:
- 紹介状 → document_type: "referral"
- 処方箋 → document_type: "prescription"
- 保険証 → document_type: "insurance_form"
- 検査結果 → document_type: "lab_result"

flags: list any issues found (e.g., "missing patient DOB", "illegible signature", "expired insurance card")"""

CLAIMS_REVIEW_SYSTEM = """You are a Japanese medical insurance claims specialist.
Review the provided claim details and identify any issues before submission.

Return ONLY valid JSON. No commentary, no markdown.

{
  "is_valid": true,
  "confidence": 0.0,
  "flags": [],
  "suggested_procedure_codes": [],
  "suggested_diagnosis_codes": [],
  "estimated_approval_rate": 0.0,
  "notes": "brief review notes in Japanese"
}

flags: list of issues (e.g., "missing diagnosis code", "procedure code mismatch", "exceeds standard amount")
estimated_approval_rate: 0.0-1.0 based on completeness and code validity"""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        default_headers={"anthropic-beta": "output-128k-2025-02-19"},
    )


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return json.loads(cleaned.strip())


def extract_from_image_url(image_url: str, media_type: str = "image/jpeg") -> dict:
    """
    Fetch image from URL and extract document data using Claude Vision.
    Used when fax provider sends a URL to the fax image.
    """
    resp = httpx.get(image_url, timeout=30)
    resp.raise_for_status()
    image_data = base64.standard_b64encode(resp.content).decode("utf-8")
    return extract_from_base64(image_data, media_type)


def extract_from_base64(image_data: str, media_type: str = "image/jpeg") -> dict:
    """
    Extract document data from a base64-encoded image using Claude Vision (Sonnet).
    """
    client = _client()

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=DOCUMENT_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Please analyze this medical document and extract all information.",
                    },
                ],
            }
        ],
    )

    return _parse_json(response.content[0].text)


def extract_from_text(text: str) -> dict:
    """
    Extract document data from plain text (simulated fax / email body).
    Falls back to text-only processing when no image is available.
    """
    client = _client()

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=DOCUMENT_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Please analyze this medical document text and extract all information:\n\n{text}",
            }
        ],
    )

    return _parse_json(response.content[0].text)


def review_claim(claim_data: dict) -> dict:
    """
    Use Claude to review a claim before submission and flag any issues.
    claim_data: dict with patient info, procedure codes, diagnosis codes, amounts.
    """
    client = _client()

    claim_text = json.dumps(claim_data, ensure_ascii=False, indent=2)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=CLAIMS_REVIEW_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Please review this insurance claim:\n\n{claim_text}",
            }
        ],
    )

    return _parse_json(response.content[0].text)
