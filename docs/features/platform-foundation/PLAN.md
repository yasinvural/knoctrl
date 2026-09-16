## Summary

Add the database, Supabase, and test-tooling foundation selected in the approved
architecture. The change will deliberately stop before defining product models
or requiring a cloud Supabase project.

## Repository Context

- The project is a root-level Next.js App Router application using TypeScript,
  strict compiler settings, Tailwind, and the `@/*` path alias.
- `package.json` currently contains only Next.js/React and base linting/styling
  dependencies; it has no database or test scripts.
- The high-level design assigns Prisma ordinary relational access and
  migrations, server-side Supabase clients for Auth/Storage, Vitest for
  unit/integration tests, and Playwright for browser acceptance tests.
- The current Node.js runtime is 20.15.0. The tooling will declare a Node 22.12+
  engine requirement rather than installing a Vitest release that is already
  obsolete.
- Existing modifications to `app/page.tsx` and deletion of `app/favicon.ico`
  predate this feature and will not be changed.

## Architecture / Approach

Prisma 7 will use a focused server-only singleton and `@prisma/adapter-pg` to
run application queries through the Supabase transaction pooler (`DATABASE_URL`).
Prisma CLI configuration will use the direct/session migration connection
(`DIRECT_URL`). A minimal, model-free Prisma schema establishes the migration
boundary without inventing product data models.

A single server-only configuration module will validate all required private
and public Supabase/database environment variables through Zod. Supabase
integration modules will provide a per-request cookie client and a separately
guarded service-role client. They will not perform database-table reads.

Vitest will default to the Node environment for service/configuration tests;
component tests may opt into JSDOM. Playwright will run a Chromium-only smoke
test against the Next.js app through its `webServer` configuration.

## Risks

- Node 20 cannot run the current Vitest release. Developers must use Node
  22.12+ before running test scripts.
- `DATABASE_URL` and `DIRECT_URL` use different Supabase connection modes;
  swapping them can cause migration failure or connection exhaustion.
- `SUPABASE_SECRET_KEY` bypasses Row Level Security. It must only be
  imported from server-only code and never exposed in client bundles/logs.
- The Supabase CLI normally requires Docker for its local stack. It will be
  installed and documented, but no local stack will run during this change.
- Playwright requires a post-install Chromium download.

## Implementation Steps

### Step 1 — Add runtime and development dependencies

**Goal**

Add the approved Prisma, Supabase, validation, and testing packages with an
explicit Node engine requirement and focused scripts.

**Expected Changes**

- Update `package.json` and `package-lock.json`.
- Add production dependencies for Prisma client/adapter, PostgreSQL driver,
  Supabase SSR/client libraries, and Zod.
- Add development dependencies for Prisma CLI, PostgreSQL types, dotenv,
  Vitest, coverage, JSDOM, Testing Library, Playwright, MSW, path resolution,
  and Supabase CLI.
- Add database, test, coverage, and browser-test scripts.

**Dependencies**

None.

**Acceptance Criteria**

- All package versions resolve into the lockfile.
- `package.json` declares Node 22.12 or newer.
- The required scripts are listed and do not contain secrets.

**Validation**

- `npm install`
- `npm run lint`

**Status**

completed

### Step 2 — Establish environment and Prisma boundaries

**Goal**

Provide validated server configuration, a reusable Prisma client, Prisma CLI
configuration, and a secret-free environment template.

**Expected Changes**

- Add server configuration modules under `server/config/`.
- Add `server/db/prisma.ts`, `prisma/schema.prisma`, and `prisma.config.ts`.
- Add `.env.example` and ignore generated Prisma client output.

**Dependencies**

Step 1.

**Acceptance Criteria**

- Configuration validation rejects absent/malformed values without rendering
  credentials in the error.
- Runtime code uses only `DATABASE_URL`; Prisma CLI uses `DIRECT_URL`.
- Generated client code is reproducible and not manually edited.

**Validation**

- `npm run db:generate`
- targeted Vitest configuration tests
- `npm run lint`

**Status**

pending

### Step 3 — Add server-only Supabase integration clients

**Goal**

Expose narrow Supabase server client factories that future Auth and Storage
features can reuse safely.

**Expected Changes**

- Add a cookie-backed server client factory and service-role client under
  `server/integrations/supabase/`.

**Dependencies**

Step 2.

**Acceptance Criteria**

- Both modules are server-only.
- The cookie client uses the publishable key; the privileged client uses the
  service-role key.
- No future product table access is introduced through Supabase clients.

**Validation**

- TypeScript/lint validation
- configuration tests

**Status**

pending

### Step 4 — Configure automated test runners and smoke coverage

**Goal**

Create consistent Vitest and Playwright execution paths and prove each runner
works against the current application.

**Expected Changes**

- Add `vitest.config.ts`, test setup, Vitest smoke/configuration tests,
  `playwright.config.ts`, and a Chromium page-load smoke test.
- Add short testing/setup guidance to the repository documentation.

**Dependencies**

Steps 1–3.

**Acceptance Criteria**

- Vitest runs Node-environment tests and supports opt-in JSDOM component tests.
- Coverage uses the V8 provider.
- Playwright waits for/reuses the Next.js web server and asserts the home page
  is visible in Chromium.
- The README explains Node, environment, local Supabase, and browser install
  prerequisites without storing secrets.

**Validation**

- `npm test`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run lint`
- `npm run build`

**Status**

pending

## Feature-Level Test Strategy

- Unit: test the environment parser with valid values and missing/malformed
  values, including an assertion that messages do not contain the supplied
  secret.
- Component: keep JSDOM and Testing Library ready; a minimal component smoke
  test confirms that setup works without coupling the foundation to the current
  marketing/home page implementation.
- Integration: defer real Supabase RLS/Auth/Storage tests until a local schema
  and policies exist; use Supabase CLI then, rather than a cloud project.
- E2E: use Playwright Chromium to load the running home page.

## Rollout / Migration

- Upgrade local and CI runtime to Node 22.12+.
- Run `npm install`, then `npm run db:generate`.
- Create `.env.local` from `.env.example` and supply Supabase dashboard values
  before executing database workflows.
- Install browser binaries with `npx playwright install chromium` before E2E
  tests.
- Later RLS/Auth/Storage integration tests can start the local Supabase stack
  with the installed CLI and Docker.

## Plan Completion Criteria

The project has committed, validated configuration and test-runner setup;
database and Supabase integrations remain server-only; dependency scripts work
on Node 22.12+; and unit/component/E2E smoke tests pass without a cloud
Supabase project.
