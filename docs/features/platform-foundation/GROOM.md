## Feature

Platform foundation: Supabase database access and automated testing.

## Goal

Establish the minimum secure, repeatable development foundation needed before
product features use the database or automated tests.

## Functional Requirements

- Add Prisma as the relational data-access and migration boundary for Supabase
  PostgreSQL.
- Add server-appropriate Supabase clients for cookie-backed authentication and
  private Storage operations; application-table access remains Prisma-owned.
- Define a validated, centralized server configuration boundary for database
  and Supabase credentials.
- Provide a committed environment-variable template that contains no secrets.
- Configure separate runtime and migration database connection variables.
- Add scripts for Prisma generation, migrations, Studio, unit tests, coverage,
  and browser tests.
- Configure Vitest for TypeScript unit and integration tests, including React
  component test support.
- Configure Playwright to start the Next.js application and run Chromium
  acceptance tests.
- Add minimal smoke tests proving each configured test runner works.

## Acceptance Criteria

- Given valid local environment variables, when Prisma is generated, then the
  project can create a reusable PostgreSQL client without database credentials
  being included in browser code.
- Given a production-like deployment, when application database queries run,
  then they use `DATABASE_URL`; when Prisma CLI migration commands run, then
  they use `DIRECT_URL`.
- Given a missing required server-side environment variable, when server
  configuration is loaded, then startup/configuration fails with a safe,
  actionable validation error and never prints its secret value.
- Given the committed environment template, then it documents every required
  variable without containing credentials.
- Given the repository dependencies are installed, when `npm test` runs, then
  a Vitest smoke test passes.
- Given the repository dependencies and Playwright Chromium browser are
  installed, when the browser-test command runs, then a Playwright smoke test
  can load the application.

## Edge Cases

- Reserved characters in connection-string passwords must be percent-encoded.
- Runtime connection, migration connection, publishable Supabase key, and
  service-role key must not be interchangeable.
- Supabase service-role credentials must stay server-only and must never use a
  `NEXT_PUBLIC_` prefix.
- Tests must not require access to a real cloud Supabase project.
- Browser binaries are a separate Playwright installation step and should be
  documented rather than committed.

## Non-Functional Requirements

- Preserve existing user changes to `app/page.tsx` and `app/favicon.ico`.
- Keep production dependencies limited to runtime needs and development
  dependencies limited to tooling.
- Target Node.js 22 LTS because current Vitest requires Node.js 22.12 or newer.
- Use Chromium only for the initial browser-test project.
- Keep configuration and database modules out of client component dependency
  graphs.

## Dependencies

- A Supabase project is required only when a developer runs migrations or
  application database flows against Supabase.
- Node.js 22.12 or newer is required for the selected current Vitest release.
- Playwright Chromium browser binaries must be installed after npm dependencies.

## Assumptions

- The approved architecture remains Prisma + Prisma Migrate for relational
  data, `@supabase/ssr` for cookie-based Supabase Auth, and Supabase Storage
  clients for Storage operations.
- This foundation introduces no product schema, RLS policy, storage bucket, or
  authentication UI.
- Local Supabase CLI setup for RLS/Auth/Storage integration testing is included
  as tooling but is not started or provisioned by this change.

## Out of Scope

- Product data models, database migrations, pgvector schema/query support, RLS
  policies, Storage buckets, and Supabase project provisioning.
- Sign-up/sign-in UI and middleware authorization flows.
- Inngest, OpenAI, Sentry, and production CI deployment configuration.
- Full integration-test fixtures and browser acceptance journeys beyond smoke
  coverage.

## Open Questions

