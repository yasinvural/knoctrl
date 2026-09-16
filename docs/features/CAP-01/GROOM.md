## Feature

CAP-01 — Account Access

## Goal

Give an individual user a persistent, private account so they can register,
sign in, sign out, and safely return to the product in later browser sessions.

## Functional Requirements

- Provide a public registration page where a new user can submit an email
  address and password to create an account through Supabase Auth.
- Registration must create an immediately usable account and signed-in session;
  email confirmation is not required for this MVP.
- Provide a public sign-in page where a registered user can authenticate with
  their email address and password.
- Provide clear navigation between registration and sign-in pages.
- After successful registration or sign-in, send the user to the authenticated
  application entry point.
- When a user with a valid session visits the public root route (`/`), redirect
  them to the authenticated application entry point rather than showing the
  public landing page.
- Persist the Supabase Auth session in secure, cookie-backed browser state so a
  returning user remains signed in until their session ends or they sign out.
- Protect authenticated application routes. A request without a valid session
  must be redirected to sign in and must not receive private page data.
- Provide sign out from authenticated product navigation. Signing out must end
  the Supabase session, clear locally rendered private account state, and send
  the user to a public page.
- Present invalid or failed registration and sign-in attempts as user-actionable
  errors without exposing secrets or internal provider details.

## Acceptance Criteria

- Given an unauthenticated visitor submits a valid, unused email address and a
  password accepted by Supabase Auth, when registration succeeds, then the
  visitor is signed in without confirming their email and reaches the
  authenticated application entry point.
- Given an unauthenticated visitor enters invalid form data, when they submit
  registration or sign-in, then the form identifies the correct fields and no
  authentication request is made until the data is valid.
- Given a registered user submits correct credentials, when sign-in succeeds,
  then they reach the authenticated application entry point.
- Given a user submits incorrect credentials, when sign-in fails, then access
  is not granted and the user sees a clear error that does not reveal sensitive
  account information.
- Given a user has a valid session, when they close and later reopen the
  browser, then visiting an authenticated route restores their signed-in
  session while it remains valid.
- Given a signed-in user visits `/`, when their session is valid, then they are
  redirected to the authenticated application entry point.
- Given an unauthenticated request for an authenticated route, when the route
  is requested directly or via browser history, then it redirects to sign in
  and returns no private product data.
- Given an authenticated user signs out, when the action completes, then their
  session is ended, they are on a public page, and authenticated routes cannot
  be revisited with the prior session.

## Edge Cases

- If the email address is already registered, the registration flow must not
  create a second account or grant access without a valid session.
- If Supabase Auth is unavailable or returns an unexpected failure, retain
  entered non-secret form state where practical, show a safe retryable error,
  and do not report success.
- If a session is expired, revoked, or cannot be refreshed, treat the request
  as signed out and redirect to sign in.
- A signed-out browser must not regain access through stale client-side state,
  back navigation, or a direct authenticated-route request.
- Email confirmation and password recovery links are intentionally absent;
  users who cannot sign in do not have a recovery path in this MVP.

## Non-Functional Requirements

- Use the existing `@supabase/ssr` cookie-backed server client and validate
  current user identity on the server for every protected request. The
  application does not create or maintain a separate session table; Supabase
  Auth owns session lifecycle records.
- Do not expose the Supabase secret/service-role key, session tokens, passwords,
  or raw provider errors in client bundles, UI, or logs.
- Configure Supabase Auth for email/password access with email confirmation
  disabled in the environment used for this feature.
- Ensure authentication cookies use Supabase's SSR integration and appropriate
  secure cookie behavior for the deployment environment.
- Make public forms keyboard-operable, label every field, associate validation
  errors with their fields, and announce submission errors accessibly.
- Keep the experience responsive at mobile and desktop widths.
- Add automated coverage for authentication form behavior, route protection,
  session restoration, and sign out; provider calls must be mockable outside
  end-to-end integration coverage.

## Dependencies

- The established Supabase project credentials in the local environment.
- Supabase Auth Email provider enabled with email confirmation disabled.
- Existing server-only Supabase cookie client and validated environment
  configuration.
- CAP-02 and later product features will supply the user-owned data whose
  visibility depends on this account boundary.

## Assumptions

- Supabase Auth remains the identity provider; Prisma is not used for account
  credentials or Supabase-managed auth records.
- CAP-01 owns authentication pages, session handling, and protected-route
  behavior, but does not introduce workspace, document, chat, or profile data
  models.
- The authenticated application entry point may initially be a minimal signed-in
  shell until CAP-02 provides workspace functionality.
- The application, rather than UI-only checks, is the authorization boundary;
  later user-owned tables and Storage objects will additionally receive RLS
  policies as part of the features that introduce them.

## Out of Scope

- Email confirmation, email-change confirmation, password reset, and account
  recovery.
- OAuth, social sign-in, magic links, multi-factor authentication, SSO, and
  organization/team membership.
- Account profile editing, account deletion, and user preferences.
- Workspace, folder, document, chat, Storage bucket, and RLS-policy creation.
- Production email-template customization and deliverability configuration.

## Open Questions
