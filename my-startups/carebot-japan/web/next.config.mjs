import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

// withSentryConfig is safe to apply even with no DSN configured -- it only
// wires up build-time instrumentation; sentry.*.config.ts still gate actual
// reporting behind NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN being set. Source map
// upload (needs a Sentry auth token) is intentionally left off for now.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: { disable: true }, // no Sentry auth token configured; skip upload entirely
});
