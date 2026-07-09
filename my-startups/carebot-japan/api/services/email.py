# apps/api/services/email.py
"""
Transactional email via Resend.
Sends appointment confirmation to patients after staff confirms from Review Queue.
"""
import html as _html
import os
import resend


def _client():
    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key or not api_key.startswith("re_") or "your_api_key" in api_key:
        print("[email] RESEND_API_KEY not configured — skipping email")
        return None
    resend.api_key = api_key
    return resend


def send_appointment_confirmation(
    *,
    to_email: str,
    patient_name: str,
    clinic_name: str,
    preferred_date: str | None,
    preferred_time: str | None,
    visit_reason: str | None,
    is_first_visit: bool | None,
    lang: str = "en",
) -> str | None:
    """
    Send a bilingual (JP/EN) appointment confirmation email.
    Returns the Resend message ID, or None if email is not configured.
    """
    client = _client()
    if not client:
        print("[email] RESEND_API_KEY not set — skipping email")
        return None

    from_address = os.getenv("EMAIL_FROM", "onboarding@resend.dev")

    # Escape before interpolating into HTML — patient_name, visit_reason, and
    # clinic_name are all patient/AI-extracted or user-submitted text, not
    # trusted markup.
    safe_patient_name = _html.escape(patient_name) if patient_name else patient_name
    safe_clinic_name = _html.escape(clinic_name) if clinic_name else clinic_name

    date_str = preferred_date or "—"
    time_str = preferred_time or "—"
    reason_str = _html.escape(visit_reason) if visit_reason else "—"

    is_ja = lang == "ja"

    if is_ja:
        subject_line = f"【予約確定】{clinic_name}"  # email Subject header, not HTML — use raw text
        header_sub = "予約確定のお知らせ"
        greeting = f"{safe_patient_name} 様"
        intro = "ご予約が確定しました。以下の内容をご確認ください。"
        labels = ["診療機関", "ご希望日", "ご希望時間", "来院理由", "初診 / 再診"]
        visit_type = "初診" if is_first_visit else ("再診" if is_first_visit is False else "—")
        closing = "ご不明な点がございましたら、クリニックまでお問い合わせください。"
    else:
        subject_line = f"Appointment Confirmed — {clinic_name}"  # email Subject header, not HTML
        header_sub = "Appointment Confirmed"
        greeting = f"Dear {safe_patient_name},"
        intro = "Your appointment has been confirmed. Please find the details below."
        labels = ["Clinic", "Date", "Time", "Reason", "Visit type"]
        visit_type = "First visit" if is_first_visit else ("Return visit" if is_first_visit is False else "—")
        closing = "If you have any questions, please contact the clinic directly."

    values = [safe_clinic_name, date_str, time_str, reason_str, visit_type]
    rows = "".join(
        f"<tr><td style='padding:6px 0;font-size:13px;color:#6b7280;width:130px'>{l}</td>"
        f"<td style='padding:6px 0;font-size:13px;color:#111827;font-weight:500'>{v}</td></tr>"
        for l, v in zip(labels, values)
    )

    html = f"""
<!DOCTYPE html>
<html lang="{lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

        <tr><td style="background:#0f766e;padding:24px 32px">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:600">{safe_clinic_name}</p>
          <p style="margin:4px 0 0;color:#99f6e4;font-size:13px">{header_sub}</p>
        </td></tr>

        <tr><td style="padding:28px 32px 24px">
          <p style="margin:0 0 12px;font-size:15px;color:#111827">{greeting}</p>
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">{intro}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
            {rows}
          </table>

          <p style="margin:20px 0 0;font-size:13px;color:#6b7280;border-top:1px solid #f3f4f6;padding-top:20px">
            {closing}
          </p>
        </td></tr>

        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:11px;color:#9ca3af">Powered by CareBot Japan</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    try:
        params = {
            "from": from_address,
            "to": [to_email.lower().strip()],
            "subject": subject_line,
            "html": html,
        }
        response = resend.Emails.send(params)
        print(f"[email] Sent to {to_email}, id={response.get('id')}")
        return response.get("id")
    except Exception as e:
        print(f"[email] Failed to send: {e}")
        return None
