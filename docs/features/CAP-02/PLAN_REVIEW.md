## Findings

### [WARNING] RLS is planned but not independently testable by the stated test path

**Problem**

The plan requires RLS policies in Step 1 and says that database integration
tests will verify RLS “when test credentials are available.” Its two-user
coverage in Step 6 can exercise the application, but application data access
uses Prisma and the shared `DATABASE_URL`, not a user-JWT-scoped Supabase data
client. That proves the application's owner predicates, not necessarily that
the RLS policies behave correctly for authenticated and unauthenticated
database/API roles.

**Impact**

A policy can be overly permissive or deny a legitimate direct Supabase request
while all Prisma-backed application tests pass. This conflicts with the
high-level design requirement for both application-level ownership checks and
RLS, and risks either a defense-in-depth gap or a future integration failure.

**Resolution**

Add an explicit RLS-validation approach to Step 1 and Step 6: against an
isolated Supabase test project, create two test users and use an authenticated
Supabase/PostgREST client for each to assert permitted own-row operations and
denied cross-user workspace/folder operations. If that environment cannot run
in CI, keep it gated like `AUTH_E2E_ENABLED`, but document the exact variables
and require it before release. Retain Prisma-based owner-isolation tests;
they test a different boundary.

**Expected Impact**

Adds a small environment-gated integration harness and makes the planned RLS
guarantee demonstrable rather than inferred.

### [WARNING] Delete confirmation counts can become stale before the destructive action

**Problem**

The plan has the detail query populate folder/document counts for the delete
dialog, then separately has the delete operation count and delete in a short
transaction. It does not say that the action must use an authoritative impact
snapshot at confirmation time or define behavior when folders change between
dialog opening and confirmation.

**Impact**

The dialog can tell the user that a workspace has one folder while a concurrent
create makes the confirmed cascade delete two. CAP-02 already has concurrent
folder creation and the approved product contract says a populated delete
confirmation must state affected counts. The issue will become more material
when CAP-03 adds documents.

**Resolution**

Amend Step 2/3 to treat dialog counts as a preview only. At confirmation, the
server action must recalculate the target's current impact inside the deletion
transaction and either: (a) require a second confirmation if the displayed
counts changed, or (b) use a confirmation design that displays the current
impact immediately before submitting. Document and test the chosen stale-count
behavior. CAP-03 should extend the same transaction to document counts and
Storage cleanup.

**Expected Impact**

Adds explicit concurrency behavior and one targeted test without changing the
CRUD scope.

### [WARNING] Step 6 promises automated coverage for a CAP-03-only acceptance criterion

**Problem**

GROOM.md includes the forward-looking criterion that deleting populated
workspaces/folders permanently deletes documents and discloses document counts.
PLAN.md correctly excludes document models, uploads, and Storage from CAP-02,
yet Step 6 says every GROOM.md acceptance criterion will have automated
coverage.

**Impact**

The stated completion gate is impossible to meet in CAP-02: there are no
document records or Storage objects to delete or count. This could result in a
false claim of feature completion or scope creep into CAP-03.

**Resolution**

Revise Step 6 and Plan Completion Criteria to classify the populated-document
cascade criterion as a CAP-03 carried-forward contract. In CAP-02, test the
current zero-document confirmation state and workspace-to-folder transaction;
in CAP-03, add the document/database/Storage cascade and its acceptance tests.

**Expected Impact**

Makes the completion definition achievable while retaining the agreed user
contract for CAP-03.

### [SUGGESTION] Specify and validate the workspace-list cursor contract

**Problem**

The plan selects cursor pagination to avoid an unbounded workspace list but
does not define the cursor format, stable ordering, malformed-cursor behavior,
or how the next-page link carries it.

**Impact**

An invalid or stale query parameter can produce a Prisma error or duplicated/
skipped workspaces as the list changes. The issue is not a current security
boundary because listing remains owner-scoped, but it weakens the promised
bounded-listing behavior.

**Resolution**

Specify a stable ordering (for example, `createdAt` then ID), an opaque or
validated UUID cursor, a fixed page size, and a safe first-page fallback or
not-found response for malformed/stale cursors. Add a unit/query test for
pagination boundaries and malformed input.

**Expected Impact**

Adds a small, deterministic query contract and test; no additional UI feature
is required beyond the already planned next-page control.

## Acceptance Criteria Coverage

- Signed-in users see only their workspace list → Steps 1, 2, 4, 6.
- Empty workspace index supports first creation → Steps 2, 4, 6.
- Valid workspace creation persists and appears in the list → Steps 2, 3, 4,
  6.
- Duplicate workspace create/rename is safely rejected → Steps 1, 2, 3, 4,
  6.
- Workspace detail shows folders, document context, and controls → Steps 2,
  4, 5, 6.
- Valid folder creation persists in the selected workspace → Steps 1, 2, 3,
  5, 6.
- Duplicate folder create/rename is safely rejected → Steps 1, 2, 3, 5, 6.
- Cross-user access or mutation reveals nothing and makes no change → Steps
  1, 2, 3, 5, 6.
- Valid workspace/folder renames appear in relevant views → Steps 2, 3, 4, 5,
  6.
- Delete cancellation changes nothing → Steps 3, 5, 6.
- Confirmed empty workspace/folder deletion removes the target and returns an
  appropriate view → Steps 1, 2, 3, 5, 6.
- Confirmed deletion of containers with documents removes documents and shows
  counts → Current zero-document and folder-cascade portions: Steps 1, 2, 5,
  6. Document/Storage portions: CAP-03; see Warning 3.
- Header badge/control signs out and returns to the public experience → Steps
  4, 6.

## Remaining Risks

- Prisma's shared database connection is intentionally separate from
  user-JWT-scoped RLS evaluation, so both application authorization and the
  separate RLS test path must remain in place.
- The first product-data migration needs a real isolated Supabase environment
  for migration/RLS confidence; the existing default Vitest environment uses
  placeholder connection values.
- CAP-03 must implement the document records, count query, transaction, and
  private Storage cleanup promised by the accepted deletion contract.
- The existing unrelated `console.log` of an authentication-provider error in
  `server/auth/authentication.ts` conflicts with the repository logging
  guidance; it is outside CAP-02 scope and should be handled separately.

## Final Assessment

No blocker prevents implementation: the data model, server-action approach,
authenticated layout, UI boundaries, and migration sequence are feasible and
cover all current CAP-02 requirements. The three warnings should normally be
adopted before implementation, particularly the explicit RLS test path and
the CAP-03 carry-forward completion boundary. The pagination detail is a
useful but optional hardening improvement.
