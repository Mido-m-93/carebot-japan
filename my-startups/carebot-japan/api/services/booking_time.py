# apps/api/services/booking_time.py
"""
Shared date/time guard for anything that books an appointment -- the LINE/
email conversational pipeline (services/scheduling.py) and the structured
web booking form (routers/appointments.py). Lives in its own module with no
imports from either so neither one has to import the other (they already
have a dependency in the opposite direction: scheduling.py imports
get_available_slots from routers.appointments).
"""
from datetime import datetime, timezone, timedelta


def is_past_datetime(date_str: str, time_str: str | None, now_jst: datetime) -> bool:
    """
    True if the requested date+time has already passed in JST. A date-only
    comparison isn't enough -- "today" stops being bookable the moment the
    requested time itself passes, e.g. requesting today at 09:00 when it's
    currently 16:00 is exactly as much in the past as requesting yesterday.
    """
    today_str = now_jst.strftime("%Y-%m-%d")
    if date_str < today_str:
        return True
    if date_str > today_str or not time_str:
        return False
    try:
        requested = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M").replace(
            tzinfo=timezone(timedelta(hours=9))
        )
    except ValueError:
        return False
    return requested < now_jst
