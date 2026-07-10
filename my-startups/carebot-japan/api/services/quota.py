# apps/api/services/quota.py
"""
Starter-tier monthly appointment quota, matching the pricing page's
"Up to 50 appointments / month" cap. Pro and enterprise clinics are unlimited.
"""
from datetime import datetime, timezone, timedelta
from services.db import get_db

STARTER_MONTHLY_LIMIT = 50


def appointments_this_month(clinic_id: str) -> int:
    db = get_db()
    now_jst = datetime.now(tz=timezone(timedelta(hours=9)))
    month_start = now_jst.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    result = (
        db.table("appointments")
        .select("id", count="exact")
        .eq("clinic_id", clinic_id)
        .gte("created_at", month_start)
        .execute()
    )
    return result.count or 0


def quota_exceeded(clinic: dict) -> bool:
    """True if this clinic's tier has hit its monthly appointment cap."""
    if clinic.get("tier", "starter") != "starter":
        return False
    return appointments_this_month(clinic["id"]) >= STARTER_MONTHLY_LIMIT
