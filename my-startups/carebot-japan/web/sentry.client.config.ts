import * as Sentry from "@sentry/nextjs";

// Inert until NEXT_PUBLIC_SENTRY_DSN is set -- no Sentry project has been
// created yet, so this is a no-op rather than an error.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0, // error tracking only, no perf tracing (avoid surprise cost)
  });
}
