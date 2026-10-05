## Summary

Implement CAP-03 as an authenticated document-ingestion flow. The browser will
ask the Next.js application for authorized upload intents, upload selected
files directly to a private Supabase Storage bucket using short-lived signed
URLs, then notify the application to enqueue processing. This keeps up to
10 MB files out of Server Action request bodies while retaining server-side
validation, ownership checks, quota enforcement, and exact-location filename
uniqueness.

Document rows, usage accounting, processing attempts, extracted chunks, and
embeddings will be persisted in Supabase PostgreSQL. Original files remain in
private Storage. An Inngest workflow will retrieve the object server-side,
extract supported content, create embeddings through the official OpenAI SDK,
and atomically make the document available only after its chunks are ready.

## Repository Context

- The application is a Next.js 16 App Router monolith. Server-rendered pages
  call services directly; small interactive children are Client Components.
- `server/auth/current-user.ts` is the server-validated identity boundary.
  Workspace Server Actions call it via a local `requireOwnerId()` helper, then
  translate typed service results into safe form state and revalidate routes.
- `server/workspaces/workspace-service.ts` owns Prisma queries and enforces
  ownership by filtering workspace/folder records through `ownerId`. Its
  existing workspace-detail query and delete functions currently assume zero
  documents, so CAP-03 must extend rather than bypass that boundary.
- `prisma/schema.prisma` contains only `Workspace` and `Folder`; the CAP-02
  SQL migration establishes RLS for both and uses database constraints for
  integrity. The next migration should add document relations and policies in
  the same style.
- `createSupabaseServiceRoleClient()` is a server-only factory appropriate for
  privileged private Storage operations. It must never enter a client bundle.
- `components/workspaces/delete-resource-dialog.tsx` already provides the
  accessible Base UI confirmation pattern. `ResourceNameForm` demonstrates
  `useActionState`, accessible errors, and targeted client boundaries.
- Vitest service/action/component tests use hoisted mocks; Playwright starts
  the Next development server. No Inngest, OpenAI, parser, or document-storage
  integration is installed yet.
- The project architecture assigns original files to private Supabase Storage,
  processing/retry orchestration to Inngest, and semantic vectors to PostgreSQL
  `pgvector`. It explicitly excludes incomplete documents from retrieval.

## Architecture / Approach

### Persistence and integrity

Add a `Document` model belonging to one workspace and optionally one folder,
with its original filename, generated private Storage key, verified size and
content type, processing status, current processing attempt, safe failure
code/message, and timestamps. Add `DocumentChunk` records with source offsets
and an embedding column managed through focused PostgreSQL/`pgvector` SQL; use
the relational row and document status as the source of truth for availability.
The vector column and similarity-query implementation are deliberately kept
behind a server-only document/retrieval boundary rather than leaking raw SQL
into pages or components.

Use an owner-keyed usage row or equivalent locked aggregate in the upload-intent
transaction to reserve and enforce the 100 MB stored-source-file quota across
all of a user's workspaces. Release a reservation when an upload cannot
complete or is cleaned up. This prevents concurrent uploads from individually
passing a non-atomic `SUM(file_size)` check.

PostgreSQL's handling of `NULL` in composite unique constraints means it cannot
alone enforce workspace-root filename uniqueness. The migration will therefore
use two case-sensitive partial unique indexes: one for `(workspace_id,
filename)` where `folder_id IS NULL`, and one for `(folder_id, filename)` where
`folder_id IS NOT NULL`. A composite database foreign-key constraint will
require every non-null folder to belong to the same workspace as its document,
while allowing a null folder for direct workspace uploads. The authorized
service lookup remains necessary to return a safe error before the database
constraint is reached.

### Upload, processing, and deletion lifecycle

The server validates a selected batch (one to ten files, each at most 10 MB,
supported extension/type, owned target, duplicate names, and remaining quota)
before reserving document rows and issuing unique signed upload paths. File
validation produces independent accepted/rejected results: valid files proceed
when another file has a file-level error, while an aggregate 10-file or quota
failure rejects the full batch. Exact duplicate names within the selection are
rejected before any conflicting intent is issued. The browser uploads each
accepted item directly to the private bucket, reports per-file progress/errors,
and calls a completion endpoint only after a successful object upload.
Completion verifies the reserved owner/document, confirms the object exists
and has the expected size, then sends an idempotent Inngest event keyed by
document ID and processing attempt.

Processing is explicit: `processing` is set while an accepted object awaits or
undergoes extraction; a successful workflow replaces any previous chunks for
that attempt, writes embeddings, then marks the document `available` in one
database transaction. Parsing, object, embedding, or empty-content failures
mark it `failed` with a safe user-facing explanation. Retrying is a conditional
failed-to-processing transition that increments the attempt; duplicate retry
requests and stale workflow events cannot create duplicate chunks or override a
newer status. A workflow re-checks the document and attempt before every state
change, so deletion during processing cannot resurrect it.

Deletion cannot be made atomic with an external object-store operation. The
service will persist storage-cleanup work transactionally with document,
folder, or workspace deletion, revoke all product access by deleting the
document rows, and dispatch idempotent cleanup work. It must also attempt
cleanup promptly and retain durable retry/logging data until every private
object is removed. CAP-02's delete paths will use this lifecycle so their
existing document counts become accurate.

### UI and provider adapters

Add a focused document-upload Client Component and document-list/status
components beneath `components/documents/`; keep pages server-rendered. The
workspace-detail page will replace its CAP-02 placeholder and zero counts with
root-document and per-folder document contexts, upload affordances, accessible
status text, retry icon buttons, and the existing confirmation dialog for
individual deletion.

Add server-only adapters for Storage, content extraction, Inngest, OpenAI
embeddings, and structured logging. The extractor adapter must support DOCX,
CSV, PDF, and TXT; parser failures are domain failures, not raw provider
errors. Use the official OpenAI JavaScript SDK with a server-only key and the
configured embedding model. Do not use OpenAI-hosted file search/vector stores:
the approved architecture retains tenant-scoped vectors and provenance in
Supabase PostgreSQL.

## Risks

- **Provider setup:** CAP-03 introduces Inngest, OpenAI, parser dependencies,
  `pgvector`, a private bucket, and new environment variables. The feature
  cannot be deployed safely until all provider credentials, bucket limits, and
  event signing configuration exist in each environment.
- **Direct upload security:** Signed upload URLs must only be issued after
  validating the owner, target, size/type metadata, quota, and exact filename.
  Generated UUID object keys must be used instead of untrusted display names.
- **Validation:** Browser MIME values and filenames are untrusted. The backend
  must enforce size/count/type limits, and processing must verify parseable
  content before availability.
- **Quota races and abandoned uploads:** A transactionally reserved usage
  aggregate plus expiry/cleanup of abandoned upload intents is required; a
  client-only byte count or an unlocked aggregate query is insufficient.
- **Schema/migration compatibility:** Prisma does not model partial unique
  indexes or `pgvector` fully, so generated migration SQL must be reviewed and
  the unsupported/vector access isolated. Existing CAP-02 migrations and RLS
  policies must remain valid.
- **External cleanup:** PostgreSQL and Storage do not share a transaction.
  Durable, idempotent cleanup records and workflow retries are required to
  avoid exposing stale objects or leaking quota after failures.
- **Workflow idempotency:** Inngest retries, user retry clicks, and stale
  events must be keyed to a processing attempt and replace old chunks rather
  than duplicate searchable data.
- **Free-plan capacity:** Supabase Free has a 1 GB Storage pool. The initial
  100 MB per-user quota and 10 MB file cap protect a small-team MVP, but are
  configuration defaults rather than a scalable billing system.
- **Abuse control:** The quota constrains retained storage but not request
  bursts. Before public deployment, configure platform/WAF request controls
  for upload-intent and completion endpoints; make any application-level rate
  policy configurable rather than hard-coding an unapproved numeric limit.

## Implementation Steps

### Step 1 — Add document configuration and provider dependencies

**Goal**

Make required server-only configuration and libraries explicit before feature
code imports them.

**Expected Changes**

- Update `package.json` and the lockfile with Inngest, the official `openai`
  SDK, and maintained extraction/parser libraries that collectively support
  DOCX, CSV, PDF, and TXT in the Node runtime used by workflows.
- Extend `.env.example`, `server/config/env.ts`, and its tests with server-only
  OpenAI and Inngest credentials, an embedding-model setting, document bucket
  name, and the initial 100 MB quota setting. Do not expose these values with a
  `NEXT_PUBLIC_` prefix.
- Add server-only factories under `server/integrations/` for OpenAI and
  Inngest, alongside Storage helpers built on the existing Supabase service
  role client. Add test seams through dependency injection or narrow adapters.
- Document required dashboard configuration: a private document bucket with a
  10 MB per-bucket size cap, restricted accepted types, and environment-specific
  credentials/event signing.

**Dependencies**

None.

**Acceptance Criteria**

- Missing or malformed new server configuration fails validation safely.
- No provider key appears in a client bundle, response, fixture, or log.
- The dependency set is sufficient for all four approved input formats and
  all adapters can be mocked outside live-provider tests.

**Validation**

- `npm run db:generate`
- `npm run lint`
- `npm test -- tests/server/config/env.test.ts`
- Adapter unit tests with mocked provider clients.

**Status**

pending

### Step 2 — Add the document, chunk, quota, and cleanup schema

**Goal**

Create durable document lifecycle data, semantic-chunk storage, quota
accounting, and database/Storage security policy foundations.

**Expected Changes**

- Extend `prisma/schema.prisma` with document relations from `Workspace` and
  `Folder`, processing-state types, document usage accounting, cleanup tasks,
  and relational chunk metadata.
- Generate a Prisma migration and augment its SQL with `pgvector` extension
  setup, a server-only vector column/index strategy, exact case-sensitive
  partial filename indexes, a composite folder/workspace consistency foreign
  key, lookup
  indexes, private-bucket creation/configuration, and RLS policies for
  document-related tables and `storage.objects`.
- Keep public access disabled. Storage-object paths must start with the owner
  ID and policy checks must require that authenticated owner.
- Update CAP-02 schema/service types only where relation fields and accurate
  document counts are needed; retain its owner-scoped query pattern.

**Dependencies**

Step 1.

**Acceptance Criteria**

- A document can be owned through its workspace and optionally assigned to a
  folder from that workspace.
- Root and folder duplicate names are rejected exactly as specified, while
  case-only variants and names in different locations are allowed.
- A concurrent upload cannot reserve more than 100 MB for one owner.
- Authenticated RLS tests permit only the owner's document/object operations;
  service-role work remains server-only.

**Validation**

- `npm run db:generate`
- `npm run db:migrate:dev` against an isolated Supabase development project
- Prisma schema/migration review
- Focused integration tests using two authenticated Supabase users and Storage.

**Status**

pending

### Step 3 — Implement document domain validation and owned services

**Goal**

Centralize document rules and lifecycle transitions outside pages, endpoints,
and workflow code.

**Expected Changes**

- Add `server/documents/` validation/types/service modules for supported files,
  batch count, byte size, exact filenames, target resolution, quota
  reservations, document listing/counts, safe result unions, retry transitions,
  and deletion/cleanup requests.
- Reuse `getCurrentUser()` only at transport boundaries; services receive the
  owner ID and apply it to every workspace/folder/document query.
- Update the workspace service's detail query to select bounded document list
  data and real document counts without an N+1 query. Select only metadata
  safe for display.
- Refactor workspace/folder deletes to create durable cleanup tasks for all
  owned descendant document object keys before cascade deletion; individual
  document deletion follows the same service.

**Dependencies**

Step 2.

**Acceptance Criteria**

- Invalid, unauthorized, missing, duplicate, quota, storage, and unexpected
  outcomes are distinct typed results and map to safe user-visible messages.
- A user cannot use a folder from another workspace or another owner as an
  upload target.
- Retry only accepts a currently failed, owned document and cannot duplicate
  chunks or processing attempts.
- Folder/workspace deletion accurately includes document counts and queues
  source-object cleanup without leaving application-visible documents behind.

**Validation**

- Unit tests for validators and status transitions.
- Mocked Prisma service tests for owner predicates, partial-name conflicts,
  quota races/usage updates, retry idempotency, and deletion cleanup records.
- `npm test -- tests/server/documents`

**Status**

pending

### Step 4 — Build signed-upload and completion transport

**Goal**

Allow the browser to upload files without routing their bytes through Next.js,
while preserving server authorization and lifecycle control.

**Expected Changes**

- Add small authenticated route handlers for upload-intent creation and upload
  completion, with Zod validation of metadata/IDs and safe structured
  per-file results. Use the service from Step 3 and signed private Storage
  upload URLs; never accept an arbitrary Storage path from the browser.
- After each direct upload, verify the owned reserved object before completing
  the document and enqueue a uniquely keyed Inngest processing event.
- Add intent expiry/cleanup handling for failed or abandoned client uploads so
  reserved quota and orphaned objects are reclaimed.
- Apply deployment-appropriate request protection to the intent/completion
  endpoints, keeping configurable request-rate controls separate from the
  approved storage quota.

**Dependencies**

Steps 1–3 and configured private Supabase Storage.

**Acceptance Criteria**

- A valid owner receives signed URLs only for their own valid, quota-reserved
  documents; invalid/over-quota/duplicate selections receive clear per-file
  errors before Storage writes.
- Completion cannot enqueue another user's document, an unreserved object, or
  a missing/mismatched object.
- Storage/network failure does not make a document available and its reservation
  is eventually released.

**Validation**

- Route-handler contract tests with mocked auth, service, Storage, and Inngest
  adapters.
- Live isolated-project smoke test for signed upload, object verification, and
  cross-user denial.
- `npm test -- tests/server/documents`

**Status**

pending

### Step 5 — Implement durable processing, extraction, and embeddings

**Goal**

Turn completed uploaded objects into traceable available source chunks, or a
truthful failed status.

**Expected Changes**

- Add Inngest client setup, event schema, and a document-processing function
  under `server/inngest/` (or the repository's established equivalent), then
  expose the framework handler through a Next route served and verified by the
  Inngest SDK/signing keys. Keep it separate from browser-authenticated routes.
- Implement server-side object retrieval and extractor adapters for every
  supported extension. Normalize text, reject empty/non-useful output, split
  it into deterministic traceable chunks, and preserve offsets/page metadata
  needed by later citations.
- Batch embedding requests through the OpenAI adapter; persist vectors and
  chunk rows, then transition the matching processing attempt to `available`
  only after the transaction succeeds.
- Map operational errors to privacy-safe failed states, structured logs, and
  Inngest retry behavior. A retry action must reprocess the original object;
  stale attempts and deleted rows must exit without restoring content.
- Add a cleanup workflow consumer that deletes queued private objects
  idempotently and records retryable failures.

**Dependencies**

Steps 1–4, a deployed/locally reachable Inngest environment, OpenAI API access,
and the `pgvector` migration.

**Acceptance Criteria**

- Successful supported files move from processing to available with chunks and
  embeddings tied to the correct document.
- Parse failure, empty content, missing object, and embedding failure move the
  current attempt to a safe failed state and create no usable source chunks.
- Duplicate events, retried jobs, and concurrent retry clicks leave at most one
  current chunk set and never make an older attempt available.
- Cleanup retries eventually remove a private object after individual,
  folder, or workspace deletion without exposing it to users.

**Validation**

- Extractor unit fixtures for DOCX, CSV, PDF, TXT, empty, and malformed
  inputs.
- Workflow tests with mocked Storage/OpenAI/Inngest and Prisma transaction
  assertions.
- Isolated integration smoke test with a supported fixture and a test embedding
  adapter; no real document contents in logs.

**Status**

pending

### Step 6 — Replace workspace document placeholders with upload and status UI

**Goal**

Give users clear, accessible document management in workspace-root and folder
contexts.

**Expected Changes**

- Add feature-local Client Components for file selection/drop handling, upload
  progress and per-file validation outcomes, document rows/status badges,
  retry icon buttons with accessible names, and individual delete controls.
- Add document Server Actions for retry and delete that follow the existing
  action-state/revalidation conventions; reuse `DeleteResourceDialog` for the
  permanent deletion confirmation.
- Update `app/app/workspaces/[workspaceId]/page.tsx` and workspace-detail data
  mapping to render root documents, documents inside each folder, real counts,
  upload destinations, processing/available/failed states, and responsive
  empty states. Remove CAP-02's “next capability” placeholder and hard-coded
  zero-document text.
- Keep large file bytes and provider clients out of Server Actions and Server
  Component props; only pass display-safe metadata and route/action references
  across the client boundary.

**Dependencies**

Steps 3–5.

**Acceptance Criteria**

- The owner can select up to 10 valid files for the workspace root or a chosen
  folder, observe independent progress/results, and see the persisted state
  after refresh.
- Invalid files, duplicate exact names, quota excess, and upload errors are
  understandable without falsely showing an available document.
- Failed documents expose a keyboard-operable retry icon button; available and
  processing documents do not.
- Deleting a document requires confirmation, respects cancellation, and
  refreshes all affected counts/contexts.
- The page remains readable and usable at mobile and desktop widths with long
  filenames and mixed document states.

**Validation**

- Component tests with mocked upload endpoints/actions for state, accessible
  labels, errors, retry, and deletion cancellation.
- `npm test -- tests/components`
- `npm run lint`
- Manual responsive keyboard screen-reader pass.

**Status**

pending

### Step 7 — Complete acceptance coverage and operational documentation

**Goal**

Prove the end-to-end contract and make environment setup/recovery repeatable.

**Expected Changes**

- Add server, workflow, component, and Playwright coverage for CAP-03's
  acceptance criteria, including two-user isolation, direct upload intent,
  limit/quota validation, status transitions, retry, deletion, and cascade
  cleanup.
- Update developer documentation with migration ordering, private bucket/RLS
  setup, 10 MB bucket limit, 100 MB configured quota, environment variables,
  Inngest local/deployed setup, and how to run integration tests safely.
- Add privacy-safe operational log/metric assertions or documented signals for
  upload acceptance, processing latency/outcomes, retry, and cleanup backlog.

**Dependencies**

Steps 1–6.

**Acceptance Criteria**

- Automated coverage verifies all CAP-03 states and no test depends on an
  unmocked production provider.
- An isolated Supabase test environment demonstrates database RLS and private
  Storage isolation for two users.
- Browser coverage proves an owner can upload a supported file, observe
  processing/available or failed/retry behavior, and permanently delete it.
- A developer can provision required services and apply the migration without
  undocumented manual schema changes.

**Validation**

- `npm run db:generate`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Isolated Supabase/Inngest integration checklist.

**Status**

pending

## Feature-Level Test Strategy

Implementation-level coverage will use Vitest for document validation,
case-sensitive scoped uniqueness mapping, quota reservations, owner predicates,
state transitions, stale-event protection, and cleanup-task behavior. Mock
Storage, OpenAI, and Inngest adapters at service/workflow boundaries. Component
tests will exercise file-selection limits, per-file errors, status text,
accessible retry labels, upload progress/result rendering, confirmation
cancellation, and keyboard operation.

Use an isolated Supabase project/CLI stack for integration tests that require
real migrations, RLS, private bucket policies, signed URLs, and two
authenticated users. Do not run those tests against shared development or
production data. Use fixture documents containing non-sensitive text. Workflow
tests should use an Inngest test harness or mocked step functions; a small
integration smoke test may use a test OpenAI adapter to avoid billing and
external-content leakage.

Playwright acceptance coverage should sign in, create a workspace and folder,
upload supported fixtures to both locations, verify status transitions and
unavailable-source exclusion at the persistence boundary, retry a forced
failure, reject an over-limit/duplicate/quota case, and verify individual,
folder, and workspace deletion remove all visible document state. Test
provider behavior deterministically rather than relying on live processing
latency.

## Rollout / Migration

1. Provision development/preview/production Supabase projects with the private
   document bucket, 10 MB bucket size limit, allowed type policy, Storage RLS,
   and distinct service credentials.
2. Add required server-only OpenAI and Inngest configuration; register and
   secure the Inngest handler before upload completion begins sending events.
3. Apply and review the Prisma/SQL migration in an isolated Supabase
   environment first, including `pgvector`, partial unique indexes, document
   RLS, and Storage policies. Generate the Prisma client from the final schema.
4. Deploy application and workflow code together. Do not expose the upload UI
   until the bucket, workflow route, and configuration health checks are ready.
5. Monitor upload failures, processing duration/failures, cleanup backlog,
   stored-byte usage, and provider errors. Adjust the configured per-user
   quota later without changing document records or client contracts.

## Plan Completion Criteria

CAP-03 is complete when an authenticated workspace owner can directly upload
one to ten supported files (each at most 10 MB) to a workspace root or folder,
within their 100 MB stored-file quota; see accurate processing, available, or
failed status; retry a failed file; and permanently delete an individual
document. Files and metadata must remain private to the owner, exact duplicate
filenames must be rejected only within the same location while case-only names
are allowed, and folder/workspace deletion must remove visible descendant
documents and reliably clean their private source objects. Available documents
must have traceable extracted chunks and embeddings; every other state must be
excluded from later retrieval. Database, Storage, workflow, UI, and
acceptance-level tests must pass along with the project's lint, type/build, and
migration checks.
