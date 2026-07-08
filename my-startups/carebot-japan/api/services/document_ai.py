# apps/api/services/document_ai.py
"""
Claude-based insurance claims review.
"""
import os
import json
import anthropic

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
