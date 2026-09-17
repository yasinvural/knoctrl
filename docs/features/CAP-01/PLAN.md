## Summary

Implement CAP-01 with Supabase Auth email/password sessions using the existing
server-only `@supabase/ssr` client factory. Public registration and sign-in
forms will submit to server actions, while an authenticated `/app` entry route
will verify the current identity with Supabase Auth on the server. A Next.js 16
`proxy.ts` will refresh cookie-backed sessions; it will not be the sole
authorization boundary. Signed-in visits to `/` will redirect to `/app`.

## Repository Context

- The root-level App Router project uses Next.js 16.3, React 19, TypeScript
  strict mode, Tailwind CSS, and the `@/*` path alias. It currently has only
  the root `app/page.tsx` placeholder and root layout.
- `@supabase/ssr`, `@supabase/supabase-js`, and Zod are already installed.
  `server/integrations/supabase/server-client.ts` exposes the reusable
  `createSupabaseServerClient(cookieMethods)` factory; it uses the validated,
  server-only configuration in `server/config/env.ts`.
- The Supabase secret/service-role client is intentionally separate and must
  not be used for user authentication or authorization.
- The existing test stack is Vitest with Testing Library/JSDOM support and a
  Chromium Playwright project. Its `server-only` test alias allows server
  modules to be unit-tested.
- There are no installed shadcn/ui source components or established product UI
  primitives. CAP-01 will initialize shadcn/ui against the existing Tailwind
  setup and add only the primitives used by its account screens.
- Current Next.js 16 uses root `proxy.ts` (the replacement for the deprecated
  `middleware.ts` convention). Supabase SSR guidance requires that proxy to
  refresh cookie tokens, while protected routes must independently verify the
  user's claims server-side.

## Architecture / Approach

Create a small `server/auth` boundary around the existing Supabase server
client. It will adapt Next.js request/response cookies for server actions and
the proxy, expose a server-side verified current-user helper, and keep cookie
mutation in contexts where Next.js permits it. Credential form actions will
validate email/password input with Zod before calling `signUp` or
`signInWithPassword`; they will map expected provider failures to safe,
actionable form errors and redirect only after a session is established.

The root page remains public and links to dedicated `/sign-up` and `/sign-in`
pages for unauthenticated visitors, but redirects a verified signed-in visitor
to `/app`. `/app` is a dynamic authenticated shell with a sign-out control. It
uses the verified current-user helper and redirects unauthenticated requests to
`/sign-in`; the proxy only refreshes session cookies for dynamic application
requests. No Prisma models, app-data queries, RLS policies, service-role auth
calls, or application-managed session table are added.

The implementation will derive credential input types from the Zod schema and
use small explicit discriminated unions for observable action and identity
states. The planned contracts are:

- `Credentials`, inferred from the credential schema, for validated email and
  password input. Password values never appear in returned action state.
- `AuthFormState`, an `idle` or `error` form state containing optional
  field-level errors, a safe form-level error, and only the non-secret email
  value needed to repopulate a failed form.
- `CurrentUserResult`, an `authenticated` result carrying Supabase's `User`
  type or an `unauthenticated` result with no user data.
- Server-action signatures that accept `FormData` (and prior `AuthFormState`
  where React action state is used) and return `Promise<AuthFormState>` on
  recoverable failure; successful credential actions redirect instead of
  returning a success state.

Exact helper names and field-error shape remain implementation details, but
these contracts constrain the public behavior and prevent passwords or raw
provider errors from entering React state.

## Risks

- Hosted Supabase projects require **Email provider enabled**, **Allow new
  users to sign up**, and **Confirm Email disabled** for the requested
  immediate-session behavior. If that dashboard configuration differs, a
  successful `signUp` may return no usable session.
- Cookie refresh requires that every changed cookie be copied to the proxy
  response. Missing this step causes session expiration or inconsistent
  server/browser identity.
- A proxy redirect is only an early navigation optimization. It uses
  `getClaims()` to refresh and validate cookies, but each protected page, route
  handler, and future server-side operation must use a server-validated current
  user lookup to detect a revoked or signed-out session before exposing data.
- Sign-up response differences and duplicate-account behavior must be mapped
  to safe UI messages without disclosing raw Supabase errors or account
  information.
- Auth attempts are an abuse surface. Supabase Auth attack-protection/rate
  limit settings must be reviewed in the project dashboard; UI pending states
  prevent accidental duplicate submissions but are not a rate-limit control.
- `@supabase/ssr` is currently documented as beta, so its client/cookie API
  should remain isolated behind the feature's server-auth boundary.

## Implementation Steps

### Step 1 — Establish reusable server authentication and session-refresh helpers

**Goal**

Adapt the existing Supabase server client to Next.js cookie contexts and create
one verified current-user path for protected server code.

**Expected Changes**

- Add focused modules under `server/auth/` for Next.js server-action cookie
  adaptation, request/response cookie adaptation for the proxy, and verified
  current-user lookup.
- Add root `proxy.ts` that calls the refresh helper for matched application
  requests and copies all refreshed cookies to the response.
- Configure the proxy matcher to exclude static assets and Next.js image
  optimization while covering public and authenticated application routes.
- Use `supabase.auth.getClaims()` in the proxy for refresh/claim validation.
  Use `supabase.auth.getUser()` in the protected current-user helper so page
  authorization is checked against Supabase Auth rather than relying only on a
  locally decoded JWT or `getSession()` user data.

**Dependencies**

None.

**Acceptance Criteria**

- A protected server page can obtain a Supabase-server-validated user identity
  or reliably distinguish an unauthenticated, expired, or revoked session.
- A request carrying a refreshable Supabase session receives all updated
  cookies in its response.
- Server-auth modules and the proxy never import the service-role client or
  expose its credentials.

**Validation**

- Targeted Vitest tests for identity-result handling and cookie propagation
  using mocked Supabase clients.
- `npm run lint`
- `npm test`

**Status**

pending

### Step 2 — Add credential validation and server-side authentication actions

**Goal**

Provide one safe mutation boundary for registration, sign-in, and sign-out.

**Expected Changes**

- Add an authentication input schema and result types under `server/auth/` or
  a feature-local equivalent, using the installed Zod dependency.
- Add server actions for sign-up, sign-in, and sign-out. Actions will use the
  Step 1 cookie adapter and existing Supabase server-client factory.
- Validate email and password before invoking Supabase Auth; preserve
  non-secret input where appropriate and return field/form errors without raw
  provider details.
- On successful sign-up or sign-in with a session, redirect to `/app`; on sign
  out, revoke the session, apply the returned cookie changes, and redirect to
  `/`.
- Treat an unexpected no-session sign-up response as a safe failure rather than
  granting access, which protects the required no-email-confirmation contract.

**Dependencies**

Step 1.

**Acceptance Criteria**

- Invalid inputs do not reach Supabase Auth and are exposed accessibly to the
  corresponding form.
- Successful registration and sign-in establish cookie-backed sessions before
  navigation to `/app`.
- Failed credentials, duplicate registration, and provider failures neither
  authenticate the visitor nor leak internal errors.
- Sign-out ends the user session and removes session cookies before redirecting
  to the public page.

**Validation**

- Targeted Vitest tests for validation, expected provider-error mapping,
  no-session registration handling, redirect results, and sign-out behavior.
- `npm run lint`
- `npm test`

**Status**

pending

### Step 3 — Build public account pages and the authenticated entry shell

**Goal**

Expose accessible, responsive account flows and ensure rendered protected
content has a server-verified identity.

**Expected Changes**

- Initialize shadcn/ui for the existing Next.js/Tailwind application and add
  the minimal account-screen primitives through its CLI: Button, Card, Input,
  Label, and Alert (or the current equivalent primitives selected by the CLI).
  Treat the generated component source as application-owned and do not add
  unused components or an alternate UI library.
- Update `app/page.tsx` into a public landing page with navigation to sign up
  and sign in for unauthenticated visitors; redirect a verified signed-in
  visitor to `/app`.
- Add `/sign-up` and `/sign-in` pages with small client form components only
  where pending/action-state feedback is needed; keep pages and auth decisions
  server-rendered by default.
- Compose the installed shadcn/ui primitives with semantic labels, native
  fields, `aria-describedby`/live error feedback, keyboard-operable controls,
  and disabled pending submit controls.
- Add `/app` as a dynamic protected page. It obtains the verified identity via
  Step 1, redirects unauthenticated visitors to `/sign-in`, and renders a
  minimal signed-in shell plus a semantic sign-out form.
- Update root metadata from the generated Next.js defaults to
  KnowledgeControl-appropriate public metadata.

**Dependencies**

Steps 1–2.

**Acceptance Criteria**

- Visitors can navigate between public registration and sign-in pages and see
  client-safe validation and submission failures.
- An authenticated visitor can reach `/app` and sign out from its navigation.
- Direct navigation, refresh, and browser-history navigation to `/app` without
  a valid session produce a sign-in redirect and no private UI.
- A valid signed-in session requesting `/` redirects to `/app`; an
  unauthenticated request still receives the public landing page.
- The account screens are usable with keyboard navigation and remain readable
  on narrow and wide viewports.

**Validation**

- Testing Library component tests for form labels, validation, pending state,
  and accessible errors.
- Manual responsive/keyboard check in the browser.
- `npm run lint`
- `npm test`

**Status**

pending

### Step 4 — Add feature-focused auth tests and replace the home smoke test

**Goal**

Prove the account boundary without coupling regular test runs to the supplied
cloud credentials.

**Expected Changes**

- Define a non-secret default test environment that supplies inert,
  schema-valid placeholder values for the current server configuration. Pass
  those values explicitly to the Playwright web server and test commands so
  they never inherit a developer's `.env` Supabase credentials.
- Add unit/contract-style tests for the auth adapters and server actions with
  mocked Supabase client responses.
- Add component tests for registration and sign-in form validation, expected
  errors, and accessible feedback.
- Replace or extend `tests/e2e/home.spec.ts` with public navigation and
  unauthenticated protected-route scenarios that run without a cloud Supabase
  account, plus a mocked/isolated assertion that a signed-in root visit moves
  to `/app`.
- Add a credential-gated Playwright authenticated journey (register, reach
  `/app`, sign out, and verify `/app` redirects) that is skipped unless an
  explicitly documented test environment is enabled. This prevents production
  credentials in `.env` from being used to create disposable E2E accounts.
- Document the local/isolated Supabase Auth test setup and dashboard settings
  needed for the credential-gated journey in `README.md`.

**Dependencies**

Steps 1–3; an isolated Supabase test project or local Supabase stack for the
credential-gated authenticated acceptance test.

**Acceptance Criteria**

- Default unit/component/E2E commands run without creating users in the cloud
  Supabase project, without requiring or inheriting real Supabase credentials.
- Auth boundary tests cover malformed input, invalid credentials, expired or
  absent/revoked identity handling, cookie updates, root-route redirect, and
  sign-out.
- When run against an explicitly configured isolated Auth environment, the
  browser journey verifies immediate registration, session restoration, sign
  out, and post-sign-out denial of `/app`.

**Validation**

- `npm test`
- `npm run test:coverage`
- `npm run test:e2e`
- Credential-gated `npm run test:e2e` in an isolated Supabase Auth environment
- `npm run lint`
- `npm run build`

**Status**

pending

### Step 5 — Verify required Supabase Auth dashboard configuration and deployment behavior

**Goal**

Confirm that provider configuration and deployment behavior satisfy the
immediate-session security contract.

**Expected Changes**

- In the Supabase dashboard for each intended environment, verify Email auth
  is enabled, sign-ups are allowed, Confirm Email is disabled, the intended
  Site URL is configured, and Auth attack-protection/rate-limit settings are
  appropriate for the environment.
- Verify Vercel environment variables are present only in server/deployment
  configuration as appropriate; the publishable key may be browser-visible but
  database and secret/service-role values may not be exposed.
- Record any environment-specific test instructions in `README.md`; do not
  commit credentials or dashboard exports.

**Dependencies**

Steps 1–4 and access to the intended Supabase/Vercel environments.

**Acceptance Criteria**

- A real sign-up on the isolated test environment immediately yields a session
  and `/app` access with no confirmation email requirement.
- Production and preview configuration use their own credentials and do not
  rely on values committed to the repository.
- Auth controls and failure telemetry can be reviewed without logging
  passwords, tokens, or cookies.

**Validation**

- Manual Supabase dashboard configuration review.
- Manual isolated-environment browser registration/sign-in/sign-out journey.
- Deployment environment-variable review.

**Status**

pending

## Feature-Level Test Strategy

### Implementation-Level Testing

- **Unit/contract tests:** Mock the existing Supabase server-client factory to
  test cookie adapters, verified identity behavior, Zod validation, provider
  error mapping, no-session sign-up handling, and sign-out cookie changes.
- **Component tests:** Use Testing Library/JSDOM for labels, required-field
  validation, accessible server-error presentation, pending submit behavior,
  and navigation links. Avoid testing Supabase itself in component tests.
- **Route/protection tests:** Test the protected page's unauthenticated redirect
  and authenticated render, and the root page's signed-in redirect, through
  mocked server-auth helpers, plus proxy cookie-copy behavior.

### Acceptance / E2E Validation

- Default Playwright tests cover public entry navigation and direct access to
  `/app` while signed out, using inert configuration and without requiring or
  inheriting cloud credentials.
- An opt-in isolated-Supabase Playwright project covers a new registration,
  immediate authenticated entry, persisted session after a fresh context or
  reload, sign out, and denied `/app` access afterward.
- Manually verify email confirmation remains disabled and inspect browser
  network/cookies only for expected secure Supabase session behavior—never
  capture tokens in logs or artifacts.

## Rollout / Migration

- No Prisma migration or product schema change is required; Supabase manages
  its Auth schema.
- Before deployment, configure each Supabase environment's email provider,
  sign-up availability, disabled Confirm Email setting, Site URL, and rate
  limits/attack protection.
- Deploy the proxy and protected page together so a newly signed-in session can
  refresh correctly and server rendering never depends on a client-only guard.
- Use a dedicated local Supabase stack or isolated cloud project for
  authenticated acceptance testing; do not use user-provided development or
  production credentials to generate E2E test accounts.

## Plan Completion Criteria

CAP-01 is complete when an individual can register and immediately receive a
cookie-backed email/password session, sign in on later visits, and sign out;
all protected server-rendered surfaces deny unauthenticated access; errors are
safe and accessible; the Supabase environment has confirmation disabled and
auth abuse controls reviewed; and the specified unit, component, browser, lint,
and production-build checks pass without secrets being committed or logged.
