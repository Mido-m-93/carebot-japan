import * as Sentry from "@sentry/nextjs";

// Inert until SENTRY_DSN is set -- no Sentry project has been created yet,
// so this is a no-op rather than an error.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
  });
}
