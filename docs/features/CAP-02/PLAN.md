## Summary

Implement CAP-02 as an authenticated workspace area under `/app`: a paginated
workspace index, workspace-detail pages for one-level folders, and a shared
authenticated header containing the sign-out badge. Persist workspaces and
folders in PostgreSQL through Prisma, enforce scoped case-insensitive names in
the database, and expose reads and mutations through small server-only
workspace modules and Server Actions.

## Repository Context

- The application is a Next.js 16 App Router project using React 19,
  TypeScript strict mode, Tailwind, and application-owned shadcn/base-ui
  primitives. Server Components are the established default; existing forms
  use small `"use client"` components with `useActionState`.
- `app/app/page.tsx` is currently the protected placeholder. It independently
  calls `getCurrentUser()` and redirects unauthenticated visitors to
  `/sign-in`; this server-validated Supabase identity helper must remain the
  authorization entry point for product code.
- CAP-01's `server/auth/actions.ts` uses Server Actions and the cookie-aware
  Supabase action client. `SignOutForm` is a reusable client form whose action
  redirects to `/` after a successful sign-out.
- `server/db/prisma.ts` provides the singleton, server-only Prisma client via
  the PostgreSQL adapter. `prisma/schema.prisma` currently has only generator
  and datasource declarations; there are no existing application data models
  or migrations.
- Zod is the existing runtime-validation dependency. Vitest tests server
  logic in Node and opt individual component tests into JSDOM; Playwright
  starts the Next development server and its authenticated acceptance suite is
  deliberately opt-in through `AUTH_E2E_ENABLED`.
- The high-level design requires application-level ownership checks plus
  Supabase PostgreSQL RLS for user-owned data. Prisma is the ordinary
  relational-data and migration boundary.

## Architecture / Approach

Add `Workspace` and `Folder` Prisma models with UUID IDs, timestamps, and a
stored normalized name. `Workspace` stores the owning Supabase Auth user UUID;
`Folder` belongs to one workspace. Composite unique constraints on
`(ownerId, normalizedName)` and `(workspaceId, normalizedName)` make
case-insensitive, trimmed name uniqueness durable without relying on UI
validation. The migration will also create narrowly scoped RLS policies based
on `auth.uid()`; the application will continue to authorize each operation
using its verified user identity because Prisma connection credentials do not
substitute for user authorization.

Use a focused `server/workspaces` boundary rather than route handlers or
client-side data fetching. Its validation module will normalize a 1–100
character name and its service/query functions will make owner-scoped Prisma
reads and atomic mutations. Server Actions will translate validation,
duplicate-name, missing-resource, and infrastructure results into safe form
state, revalidate affected routes, and redirect after deletion where the
resource's page no longer exists.

The `/app` route becomes a server-rendered, cursor-paginated workspace index;
`/app/workspaces/[workspaceId]` is the server-rendered detail route. An
`/app/layout.tsx` verifies the user for the authenticated shell and renders the
persistent header; pages and actions independently resolve the verified user
needed for their owner-scoped data operation. Reusable, feature-local client form/dialog
components provide pending state, accessible errors, and native focus-managed
confirmation dialogs while all ownership and persistence remains server-side.

CAP-02 will cascade workspace-to-folder deletion in a database transaction.
Because documents do not yet exist, confirmation counts report zero documents
and the schema leaves document relations for CAP-03. CAP-03 must add its
document and Storage-object deletion work to the same confirmed cascade
contract; CAP-02 must not add speculative document tables or Storage calls.

## Risks

- Scoped uniqueness has a race condition if implemented as a preflight query;
  the composite unique constraints and safe unique-violation mapping are
  required to handle concurrent creates/renames correctly.
- RLS migration SQL and Prisma migrations must be reviewed together. A policy
  error could either block valid product traffic or expose data through a
  Supabase data API, even though application-level owner filters are correct.
- Supabase Auth owns the user table. The migration must use compatible UUID
  owner columns and RLS expressions without attempting to manage Auth users
  through Prisma.
- A delete action can be submitted from a stale page or retried. Mutations
  must scope by owner, handle a missing row without false success, and keep
  the UI recoverable on failure.
- Cache invalidation after Server Actions must refresh both `/app` and the
  affected workspace detail page so stale names and folders do not remain
  visible.
- The sign-out form is moving from the placeholder page into the authenticated
  layout; its client action and error behavior must remain intact.

## Implementation Steps

### Step 1 — Add the workspace and folder persistence model

**Goal**

Create the relational foundation that enforces ownership, one-level folder
containment, scoped case-insensitive names, and workspace-to-folder cascade
deletion.

**Expected Changes**

- Extend `prisma/schema.prisma` with `Workspace` and `Folder` models, UUID
  primary keys, owner/workspace foreign-key fields, display name,
  normalized-name, and created/updated timestamps.
- Define the two composite unique constraints and query-supporting indexes
  needed for owner-scoped workspace listing and workspace-scoped folder
  listing. Use the schema's supported relation cascade for workspace-to-folder
  deletion.
- Generate a Prisma migration under `prisma/migrations/`. Add reviewed SQL to
  enable RLS and create owner-only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`
  policies for workspaces and workspace-owner-derived equivalent policies for
  folders.
- Regenerate the checked/generated Prisma client according to the repository's
  `db:generate` workflow; do not commit credentials or change environment
  configuration.

**Dependencies**

None.

**Acceptance Criteria**

- PostgreSQL rejects duplicate normalized workspace names for one owner and
  duplicate normalized folder names in one workspace, while allowing the same
  display name in another permitted scope.
- A folder cannot refer to a nonexistent workspace, and deleting a workspace
  deletes its folders atomically.
- RLS policies restrict direct user-scoped table access to the matching
  Supabase Auth user.

**Validation**

- Run `npm run db:generate`.
- Apply the migration against the configured development database with the
  established Prisma migration command.
- Inspect the generated migration and verify constraints/RLS policies with
  targeted database integration checks before proceeding.

**Status**

completed

### Step 2 — Build validated, authorized workspace-domain operations

**Goal**

Create one server-only boundary for safe workspace/folder reads and CRUD
mutations.

**Expected Changes**

- Add focused modules under `server/workspaces/` for Zod name validation and
  normalization, result/form-state types, and owner-scoped query/mutation
  functions using `server/db/prisma.ts`.
- Limit normalized display names to 1–100 characters after trimming. Use the
  same normalization for validation and persistence, and return only safe
  field/form errors to callers.
- Implement an owner-scoped workspace index query with a stable cursor-based
  page size, workspace-detail query with its folders, create/rename/delete
  workspace operations, and create/rename/delete folder operations.
- Have every operation receive a verified owner ID, include it in database
  predicates, select only fields needed by each view, and return a safe
  unavailable result for absent or non-owned resources.
- Put workspace deletion and its count lookup in a short Prisma transaction;
  provide zero document counts until CAP-03 supplies document data. Map Prisma
  unique violations to the normal duplicate-name result and preserve a
  distinct retryable result for unexpected failures.

**Dependencies**

Step 1; CAP-01's `getCurrentUser()` helper.

**Acceptance Criteria**

- Invalid or whitespace-only names never reach persistence.
- All reads and mutations are restricted to the verified owner, including
  folder operations through their parent workspace.
- Duplicate-name conflicts, missing resources, and unexpected failures have
  distinguishable, safe outcomes; no raw database error reaches a client.
- Workspace and folder deletions are atomic and report the target/counts
  needed by the confirmation UI.

**Validation**

- Add Vitest coverage for normalization, validation, scoped duplicate mapping,
  owner predicates, missing targets, and deletion transaction behavior using
  mockable Prisma collaborators or an isolated database test setup.
- Run `npm test` and `npm run lint`.

**Status**

completed

### Step 3 — Expose workspace mutations through Server Actions

**Goal**

Connect authenticated form submissions to the domain boundary without moving
authorization or database access into client components.

**Expected Changes**

- Add workspace/folder Server Actions under `server/workspaces/`, following
  CAP-01's action signatures and `useActionState` result conventions.
- Resolve the current user in every action before calling a domain operation;
  reject unauthenticated submissions without revealing product data.
- Parse route/form identifiers at the action boundary, map domain results to
  accessible field/form errors, call `revalidatePath` for the index and detail
  routes after successful mutations, and redirect after confirmed resource
  deletion.
- Ensure destructive actions require an explicit confirmed form value from the
  dialog; they must never infer confirmation merely from a delete-button
  click.

**Dependencies**

Step 2.

**Acceptance Criteria**

- A forged workspace/folder ID or another user's ID cannot update, disclose,
  or delete private data.
- Valid mutations refresh the appropriate server-rendered views; failed
  mutations retain input where useful and display a safe error.
- Cancellation submits no delete action, and a delete action without explicit
  confirmation makes no change.

**Validation**

- Add targeted Vitest tests for action authorization, domain-result mapping,
  revalidation/redirect decisions, and confirmation enforcement.
- Run `npm test` and `npm run lint`.

**Status**

completed

### Step 4 — Establish the authenticated layout and workspace index

**Goal**

Make `/app` the usable signed-in home with consistent navigation and workspace
creation/listing.

**Expected Changes**

- Add `app/app/layout.tsx` to verify the session for the authenticated shell,
  redirect unauthenticated requests to `/sign-in`, and render a responsive
  product header. Keep page-level data access independently authorized rather
  than relying on the layout as an authorization boundary.
- Add a focused authenticated-header component that exposes the signed-in
  user's badge/control and composes the existing `SignOutForm`; retain its
  pending/error behavior and give the control an accessible sign-out name.
- Replace `app/app/page.tsx` with a server-rendered workspace index that uses
  the Step 2 query, renders an empty state, a stable workspace list, and the
  first page's pagination control when additional results exist.
- Add feature-local client workspace-create and workspace-management form
  components. Reuse existing Input, Label, Button, Card, and Alert primitives;
  add only the standard dialog primitive needed for accessible destructive
  confirmation rather than creating a custom modal system.
- Link workspace items to their detail routes and keep layout/content usable
  at narrow and wide viewport sizes.

**Dependencies**

Steps 2–3.

**Acceptance Criteria**

- `/app` shows only the signed-in user's workspaces, including an actionable
  empty state when none exist.
- A user can create a workspace, see validation/errors accessibly, and open a
  listed workspace.
- The header is present across authenticated pages and its badge/control signs
  the user out through the existing safe sign-out flow.
- Direct unauthenticated navigation to `/app` and descendants still redirects
  before private product UI is rendered.

**Validation**

- Add JSDOM component tests for labeled workspace creation, pending/error
  feedback, empty/list states, and the header sign-out control.
- Manually check header and workspace index responsiveness and keyboard use.
- Run `npm test` and `npm run lint`.

**Status**

completed

### Step 5 — Add workspace-detail and folder CRUD experiences

**Goal**

Complete the organization workflow inside an owned workspace while making
destructive operations explicit and accessible.

**Expected Changes**

- Add `app/app/workspaces/[workspaceId]/page.tsx`, which independently
  resolves the verified user, loads the owner-scoped detail data, and returns
  the appropriate not-found outcome for unavailable IDs without revealing
  ownership.
- Build feature-local folder list/create/rename/delete controls and workspace
  rename/delete controls. Use small client components only where action state,
  editable input, or dialog state is required.
- Render folder empty states and the CAP-03-not-yet-available document context;
  do not add upload controls, document tables, or Storage calls.
- Use the dialog primitive for named permanent-delete confirmations. The
  workspace dialog displays the affected folder count and zero documents;
  folder dialog displays zero documents. It must support cancel, keyboard
  dismissal, focus return, pending state, and retryable failure feedback.
- Redirect to `/app` after a confirmed workspace deletion and keep the user on
  the workspace page after folder deletion, with revalidated folder data.

**Dependencies**

Steps 3–4.

**Acceptance Criteria**

- An owner can create, rename, and delete folders only inside the selected
  workspace, and rename/delete the workspace itself.
- Detail routes neither render nor mutate another user's workspace/folder
  data.
- Each empty workspace/folder context is clear and usable; a workspace with
  no folders remains valid.
- Deletion changes nothing until confirmation, then permanently removes the
  correct current CAP-02 records and returns/refreshed views as specified.

**Validation**

- Add JSDOM tests for accessible labels/errors and delete dialog confirmation,
  cancellation, focus behavior, and pending/error feedback.
- Add server/action tests for owner-only folder CRUD and detail unavailability.
- Run `npm test` and `npm run lint`.

**Status**

completed

### Step 6 — Verify the feature across persistence and browser flows

**Goal**

Confirm CAP-02's contract works end-to-end and that the migration can be
applied safely.

**Expected Changes**

- Add or extend Playwright acceptance coverage, gated consistently with the
  existing isolated-auth configuration, for sign-in to `/app`, workspace CRUD,
  folder CRUD, empty states, delete confirmation/cancellation, and header
  sign-out.
- Add an integration scenario using two authenticated users (or equivalent
  isolated server/database coverage) to confirm cross-user workspace and
  folder isolation and scoped duplicate-name behavior.
- Update only documentation necessary to explain applying the CAP-02 migration
  or running the new opt-in acceptance coverage.

**Dependencies**

Steps 1–5 and configured isolated Supabase/Auth database credentials for live
integration coverage.

**Acceptance Criteria**

- All GROOM.md acceptance criteria have an automated test at the most
  appropriate layer or a documented environment-gated acceptance test.
- The migration applies on an empty development database and the application
  builds, lints, and tests successfully.
- Browser flows confirm no private workspace UI survives sign-out or becomes
  reachable while unauthenticated.

**Validation**

- `npm run db:generate`
- Apply the development migration with `npm run db:migrate:dev`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`, with the isolated authenticated suite enabled when its
  credentials are available

**Status**

completed

## Feature-Level Test Strategy

Implementation-level tests will use Vitest for Zod normalization/validation,
Prisma-result mapping, scoped query/mutation authorization, confirmed-delete
contracts, and Server Action result behavior. JSDOM/Testing Library tests will
cover input labels, errors, pending controls, empty states, account-badge sign
out, and accessible confirmation dialog behavior. Database integration tests
will verify the migration's constraints, cascading relations, and RLS
isolation when test credentials are available.

Acceptance tests will use the existing Playwright setup. Public route-protect
tests remain always runnable; live authenticated workspace/folder scenarios
follow the established `AUTH_E2E_ENABLED` isolation guard. The acceptance path
will create a workspace, create/rename/delete a folder, rename/delete the
workspace with cancel and confirm branches, sign out from the header, and
verify protected routes redirect afterwards. A two-user scenario will prove
that cross-user reads and mutations fail safely.

## Rollout / Migration

This feature introduces the first product-data migration. Generate and review
the Prisma migration, including its manual RLS SQL, against a disposable or
development Supabase database before deployment. Apply migrations through the
existing Prisma Migrate workflow before deploying code that queries the new
tables. Deploy the application and migration together; rolling back application
code is safe because the added tables are not consumed by earlier releases.

Before CAP-03, retain the workspace/folder deletion UI's zero-document counts.
CAP-03 must extend the schema, count query, transaction, and private Storage
cleanup to make the already-approved permanent document cascade real rather
than changing CAP-02's user contract.

## Plan Completion Criteria

CAP-02 is complete when a signed-in user reaches the `/app` workspace index,
can perform all confirmed workspace and one-level folder CRUD operations on
only their own data, sees clear empty/error states, and signs out from the
persistent header. Database migration constraints and RLS enforce the intended
data boundary; server actions independently enforce it; all required unit,
component, integration-capable, and browser acceptance coverage passes along
with lint and production build validation.
