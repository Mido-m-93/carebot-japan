# apps/api/services/limiter.py
"""
Shared slowapi rate limiter instance.

Kept in its own module (rather than instantiated in main.py) so routers can
import it directly without creating a circular import with the FastAPI app
itself (main.py imports the routers, so the routers can't import back from
main).

Keyed by client IP — this protects public, unauthenticated endpoints
(the web booking widget, slot lookup, clinic-by-slug lookup) from being
scripted/flooded. Authenticated dashboard endpoints already have a JWT
check, and signature-verified webhooks (Stripe/LINE/Mailgun) already have a
strong control, so neither needs this on top.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
