# PRD: StartupRobos セキュリティ強化・テスト基盤・コード品質改善

## Problem Statement

StartupRobos は初期プロダクトとして少数ユーザーに提供されているが、全 API エンドポイントに認証がなく、レート制限はサーバーレス環境で機能せず、トークン予算更新に競合条件がある。URL を知っている第三者が他人のエージェント実行・予算消費・ピボット操作を行える状態にある。また、テストが一切存在しないため、PII マスキングの正規表現バグ（日本語電話番号が通過する）を含め、セキュリティモジュールの正しさを検証できない。コード重複（TOKEN_COSTS 3重、TASK_AGENT 6重）が保守性を下げている。

## Solution

3フェーズに分けて改善する:
1. **セキュリティ**: Next.js middleware による認証ゲート、Upstash Redis レート制限、トークン予算のアトミック更新、メール送信時の HTML エスケープ
2. **テスト基盤**: Vitest 導入と全セキュリティ/ビジネスロジックモジュールのユニットテスト
3. **コード品質**: 定数・ユーティリティの一元化による重複解消

## User Stories

1. As a startup owner, I want my API endpoints to require authentication, so that unauthorized users cannot execute my agents or consume my token budget
2. As a startup owner, I want ownership verification on every API call, so that another user cannot manipulate my startup's data (IDOR prevention)
3. As a platform operator, I want rate limiting that works in a serverless environment, so that a single user or attacker cannot exhaust Claude API credits through rapid requests
4. As a platform operator, I want token budget deduction to be atomic, so that concurrent requests cannot bypass the spending limit
5. As a startup owner, I want PII to be correctly masked before being sent to Claude, so that my personal data (including Japanese phone numbers) is never leaked to the LLM
6. As a platform operator, I want email notifications to escape HTML from AI responses, so that indirect XSS injection through crafted model output is prevented
7. As a platform operator, I want hardcoded email addresses removed from source code, so that they are not exposed in the public repository
8. As a developer, I want a test framework with unit tests for security-critical modules, so that regressions in PII masking, rate limiting, cost calculation, and budget deduction are caught before deployment
9. As a developer, I want TOKEN_COSTS defined in a single file, so that model pricing changes require only one update
10. As a developer, I want TASK_AGENT role/color/label mapping defined once, so that adding a new CXO role does not require editing 6 files
11. As a developer, I want a shared Anthropic client singleton, so that instantiation is consistent and testable
12. As a developer, I want heartbeat cron endpoints to continue working with CRON_SECRET after auth middleware is added, so that scheduled jobs are not broken
13. As a startup owner, I want the dashboard data endpoint to require authentication, so that all tenant data is not exposed to unauthenticated requests
14. As a developer, I want calcCost to use the centralized TOKEN_COSTS instead of hardcoded magic numbers, so that pricing drift between files is impossible
15. As a developer, I want timeAgo defined once, so that the 3 current copies do not diverge in behavior

## Implementation Decisions

### Module 1: Auth Middleware
- Implement a Next.js middleware (`middleware.ts` at project root) using `@supabase/ssr` `createServerClient`
- Match routes: `/api/agent/:path*`, `/api/cxo/:path*`, `/api/pivot`, `/api/dashboard/:path*`
- Exclude: `/api/heartbeat/:path*` (uses existing `CRON_SECRET` bearer token auth)
- Each protected route handler adds an ownership check: `startup.user_id === session.user.id`
- The middleware sets the authenticated user on the request (via headers or cookies) so route handlers can access it without re-parsing

### Module 2: Rate Limiter
- Replace in-memory `Map`-based rate limiting with `@upstash/ratelimit` + `@upstash/redis`
- Extract a shared module that exports a factory function: `makeRateLimiter(limit, windowMs)` returning a `check(key) => Promise<boolean>` interface
- Agent run endpoint: 10 requests per 60 seconds per user
- CXO council endpoint: 3 requests per 60 seconds per user
- New env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Module 3: PII Masker
- Fix phone regex to handle Japanese mobile format (3-4-4 digit segments: `090-1234-5678`, `080-xxxx-xxxx`)
- Add international prefix support (`+81-3-1234-5678`)
- Interface remains: `maskPII(text: string): string`

### Module 4: Budget Deduction (Atomic)
- Create a Supabase RPC function `deduct_budget(p_user_id uuid, p_amount numeric)` that performs an atomic `UPDATE ... WHERE (total_usd - spent_usd) >= p_amount`
- Raises exception if budget is insufficient (caller catches and returns 402)
- Replace the current SELECT-then-UPDATE pattern in `harness.ts` and `council.ts`

### Module 5: Cost Calculator
- Extract `TOKEN_COSTS` and `calcCost` into a single module
- All 5 files that currently duplicate these values import from the shared module
- `calcCost` throws on unknown model names (already does, but now testable in isolation)

### Module 6: Notify Sanitization
- Add `escapeHtml(s: string): string` that escapes `&`, `<`, `>`
- Apply to all regex capture group replacements in the markdown-to-HTML conversion
- Remove hardcoded fallback email; skip send when `NOTIFY_EMAIL` is not set

### Module 7: Code Deduplication (Phase 3)
- `TASK_TYPE_AGENT` role/color/label map: single source of truth, other 6 files import
- `timeAgo`: single utility, 3 files import
- Anthropic client: singleton export, all files import
- heartbeat/cxo for-loop: extract shared helper for the duplicated iteration body

### Intentionally excluded
- `timingSafeEqual` for CRON_SECRET comparison (timing attack infeasible over network)
- CSP `unsafe-eval` removal (requires Next.js App Router compatibility investigation)
- `pivot_log` UPDATE/DELETE RLS policies (RLS default-deny is sufficient)
- Visual component tests (SVG/Canvas components are better validated by E2E)

## Testing Decisions

A good test for this project:
- Tests the external behavior of a module through its public interface, not implementation details
- Does not depend on network access, database state, or external services
- Uses dependency injection or module mocking for external boundaries (Supabase client, Anthropic SDK, Upstash Redis)
- Covers boundary values and error paths, not just happy paths

### Modules with tests

1. **Auth middleware** (`middleware.test.ts`)
   - Unauthenticated request to protected route returns 401
   - Authenticated request passes through with user info
   - Heartbeat routes are excluded from auth check
   - Ownership mismatch returns 403

2. **Rate limiter** (`rateLimit.test.ts`)
   - First request within window passes
   - Request at limit boundary is rejected
   - Window reset allows new requests
   - Different keys are independent

3. **PII masker** (`piiMasker.test.ts`)
   - Standard email masked
   - Dotted/subdomain email masked
   - Japanese mobile phone (090-xxxx-xxxx) masked
   - International phone (+81-3-xxxx-xxxx) masked
   - Credit card number masked
   - Clean text passes through unchanged
   - Empty string returns empty string

4. **Budget deduction** (`budgetDeduction.test.ts`)
   - Sufficient budget deducts correctly
   - Insufficient budget throws/rejects
   - Concurrent calls do not double-spend (mock atomic RPC)
   - Zero amount edge case

5. **Cost calculator** (`costs.test.ts`)
   - Known model returns correct cost
   - Unknown model name throws error
   - Zero tokens returns zero cost
   - Large token counts calculate correctly

### Prior art
No existing test infrastructure. Vitest will be set up from scratch with `vitest.config.ts` and path alias resolution matching `tsconfig.json`.

## Out of Scope

- User registration/login UI (Supabase Auth provides hosted UI or can be added separately)
- E2E tests for dashboard pages (separate task, use `e2e-tester` agent)
- Database migration tooling (Supabase CLI handles this)
- Performance optimization of SVG components
- CI/CD pipeline setup (Vercel handles deployment)
- Monitoring/alerting infrastructure (Vercel + Axiom integration is a separate initiative)

## Further Notes

- The project was renamed from "Launchpad" to "StartupRobos"; the local clone still references the old remote in git history
- Vercel cron jobs for heartbeat endpoints must remain functional after auth middleware is added; they are explicitly excluded from the middleware matcher
- Phase 1 (security) and Phase 2 (tests) can proceed in parallel on separate branches if needed
- Phase 3 (deduplication) depends on Phase 1/2 completion to avoid merge conflicts
- Upstash Redis has a free tier sufficient for this stage; no cost increase expected
