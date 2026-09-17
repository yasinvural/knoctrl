## Findings

### [BLOCKER] Current runtime cannot execute the plan's required validation

**Problem**

The repository requires Node.js 22.12 or newer, but the active workspace is
running Node.js 20.15.0. CAP-01 relies on Vitest, the shadcn CLI, Next.js build
validation, and the existing test scripts; the prior platform-foundation
validation already recorded that current Vitest cannot start under Node 20.

**Impact**

Implementation could be written, but its unit/component coverage and required
validation commands cannot be run in this workspace. This would make the
feature's security-sensitive authentication behavior unverified and leave the
repository unable to meet the plan completion criteria.

**Resolution**

Add an explicit prerequisite before Step 1: switch the development/CI runtime
to Node.js 22.12 or newer, verify it with `node --version`, reinstall
dependencies if the runtime manager requires it, and run the existing baseline
test command before CAP-01 changes begin.

**Evidence**

- `package.json` declares `"node": ">=22.12.0"`.
- The active environment reports `v20.15.0`.
- `docs/features/platform-foundation/VALIDATION_REPORT.md` records Vitest as
  blocked by Node 20.15.0.

**Expected Impact**

This unblocks dependable lint, test, coverage, and build validation without
changing product scope or architecture.

### [BLOCKER] The default test strategy has no credential-free environment contract

**Problem**

The plan requires default unit/component/E2E commands to avoid the supplied
cloud Supabase project, but it does not define how the application obtains the
required environment variables in that mode. `server/config/env.ts` validates
`DATABASE_URL`, the Supabase URL, publishable key, and secret key at module
load. The planned proxy and pages will import server-auth code during browser
tests, while the current Playwright `webServer` simply runs `npm run dev` and
therefore inherits the developer's `.env`.

**Impact**

Fresh or CI test runs can fail before a test starts when credentials are absent,
or unintentionally use the developer's cloud credentials when they are present.
That contradicts the plan's deterministic, credential-free default test claim
and makes accidental external Auth traffic more likely.

**Resolution**

Amend Step 4 to establish an explicit non-secret test environment: provide a
documented test-only environment template or Playwright `webServer.env` values
that satisfy the configuration schema with inert placeholders, and ensure the
default tests do not call Supabase for their unauthenticated scenarios. Keep
the isolated Auth E2E configuration separate, opt-in, and explicitly named.
Add tests proving the default command starts with the inert configuration and
the opt-in command is the only one allowed to create accounts.

**Evidence**

- `server/config/env.ts` creates `serverEnvironment` by parsing `process.env`
  at import time and requires all four variables.
- `playwright.config.ts` has no test-specific environment override and launches
  `npm run dev` directly.
- Step 4 promises default E2E coverage without cloud credentials while Step 1
  adds a proxy that runs on application requests.

**Expected Impact**

Default verification becomes repeatable and cannot consume or create data in
the supplied Supabase project; real Auth acceptance coverage remains available
only in an intentionally isolated environment.

### [BLOCKER] Post-sign-out cache and browser-history invalidation is unspecified

**Problem**

CAP-01 requires that sign-out clear previously rendered private state and that
back navigation cannot restore it. The plan ends a session and redirects, but
does not state how authenticated responses avoid server/client/browser caches,
how the Next.js router cache is invalidated after the sign-out action, or how a
browser-history path is tested after sign-out.

**Impact**

Even if a new request to `/app` is denied, a browser may display a previously
rendered authenticated route from its router or history cache. That fails the
explicit privacy edge case and may reveal the signed-in shell or future private
workspace data after sign-out.

**Resolution**

Amend Steps 1–4 to define the cache policy for authenticated routes and the
sign-out transition: render protected routes dynamically with no user-specific
response caching, invalidate the relevant Next.js route cache before redirect,
and ensure the client lands on a public route without retained private state.
Add an authenticated E2E scenario that signs out, uses browser Back, and
asserts the protected route is redirected before private content renders. The
implementation should use the current Next.js-supported cache APIs rather than
inventing custom browser storage clearing.

**Evidence**

- `GROOM.md` requires sign-out to clear locally rendered private account state.
- Its Edge Cases require a signed-out browser to resist stale client state and
  back navigation.
- The plan's E2E wording checks post-sign-out denial of `/app`, but does not
  explicitly exercise browser Back or define response/router cache behavior.

**Expected Impact**

The private-data guarantee is concrete, implementable, and acceptance-tested
before CAP-02 adds actual workspace and document content.

## Acceptance Criteria Coverage

- AC1 — Immediate registration and authenticated entry → Steps 2, 3, 4, 5.
- AC2 — Invalid form input is blocked and explained → Steps 2, 3, 4.
- AC3 — Valid credentials sign in → Steps 2, 3, 4, 5.
- AC4 — Invalid credentials deny access safely → Steps 2, 3, 4.
- AC5 — Valid session is restored across browser visits → Steps 1, 3, 4.
- AC6 — Signed-in root visit redirects to `/app` → Steps 1, 3, 4.
- AC7 — Unauthenticated authenticated-route access is denied → Steps 1, 3, 4.
- AC8 — Sign-out ends access and prior session cannot revisit protected content
  → Steps 1, 2, 3, 4; the cache/history blocker above must be resolved for
  complete coverage.

## Remaining Risks

- Hosted Supabase configuration remains an external dependency: Email auth and
  sign-ups must be enabled, Confirm Email disabled, and the Site URL and attack
  protection reviewed in each environment.
- `@supabase/ssr` is beta; keeping its cookie adapter within `server/auth`
  limits the cost of any API change.
- Server-validated current-user checks add an Auth request to protected page
  rendering. This is appropriate for the requested revocation behavior, but
  should be observed as authenticated traffic grows.
- The shadcn/ui initializer may add its standard generated utility and runtime
  dependencies. They should be reviewed as feature-owned source and kept to
  the selected primitives.

## Final Assessment

Implementation must not begin yet. The feature contract is complete and the
architecture is viable, but the three blockers must be incorporated into the
plan: a Node 22.12+ validation prerequisite, a deterministic inert default
test environment, and explicit sign-out cache/history invalidation with an E2E
scenario. No changes were made to `PLAN.md` during this validation stage.
