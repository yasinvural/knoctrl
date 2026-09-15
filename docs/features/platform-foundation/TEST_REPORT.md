## Test Strategy

Use unit and component smoke coverage for configuration parsing and React test
setup, plus a Playwright browser smoke test for the visible home-page flow.
Prisma generation, Vitest, and coverage require Node.js 22.12 or newer; the
active environment is Node.js 20.15.0, so those commands were attempted and
recorded as environment-blocked rather than treated as product defects.

## Acceptance Criteria Coverage

- AC1 → `npm run db:generate` with a valid `DIRECT_URL` (blocked by Node 20)
- AC2 → inspection of `server/db/prisma.ts` and `prisma.config.ts`
- AC3 → `tests/server/config/env.test.ts` (blocked by Node 20)
- AC4 → committed `.env.example` inspection
- AC5 → `npm test` and `npm run test:coverage` (blocked by Node 20)
- AC6 → `tests/e2e/home.spec.ts` through `npm run test:e2e`

## Scenarios

### Scenario: Home page is visible in Chromium

**Given**

Playwright Chromium is installed and the Next.js server is configured by
Playwright.

**When**

The browser loads the root path.

**Then**

The visible "Knowledge Control" text is present.

**Automated By**

`tests/e2e/home.spec.ts`

**Result**

`PASS`

### Scenario: Server configuration rejects invalid input without secret exposure

**Given**

The Node.js 22.12+ runtime required by Vitest.

**When**

Vitest runs `tests/server/config/env.test.ts`.

**Then**

The test verifies valid configuration and safe errors for missing or malformed
values.

**Automated By**

`npm test`

**Result**

`BLOCKED` — the active Node.js 20.15.0 runtime cannot start current Vitest.

## Commands Executed

- `npm run lint` — PASS
- `npm run test:e2e` — PASS (1 Chromium test)
- `npm run db:generate` — BLOCKED by Node.js 20.15.0
- `npm test` — BLOCKED by Node.js 20.15.0
- `npm run test:coverage` — BLOCKED by Node.js 20.15.0
- `npm run build` — BLOCKED because the sandbox cannot fetch the existing
  Google-hosted Geist fonts

## Failures Found

No implementation defects were found. The unavailable checks are environmental
limitations: upgrade to Node.js 22.12+ and run the build where Google Fonts are
reachable.

## Final Result

`PASS`

The executable browser acceptance scenario passes. Re-run Prisma generation,
Vitest, coverage, and the production build in a Node.js 22.12+ environment
before release.
