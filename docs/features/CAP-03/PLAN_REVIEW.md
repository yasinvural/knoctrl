## Findings

### [RESOLVED] Legacy DOC is excluded from the initial release

**Problem**

The original plan included legacy binary `.doc`, which can require native
executables unavailable in a Vercel/Inngest runtime. The approved CAP-03 scope
now excludes `.doc` and retains DOCX, CSV, PDF, and TXT.

**Impact**

The initial release no longer risks a legacy-DOC runtime gap.

**Resolution**

Step 1 now requires parsers and fixtures only for DOCX, CSV, PDF, and TXT.
Legacy `.doc` support remains explicitly out of scope for a later capability.

**Expected Impact**

Eliminates a legacy-parser dependency from the initial implementation.

### [WARNING] The plan does not explicitly preserve valid files in a mixed-invalid selection

**Problem**

GROOM.md requires independently validated and reported files in a mixed
selection. The architecture says the server validates an “entire selected
batch” before reserving rows and issuing URLs, which could be interpreted as
rejecting valid files merely because another selected file is invalid.

**Impact**

The UI may not satisfy the agreed per-file feedback behavior and could make
users repeatedly reselect otherwise valid files.

**Resolution**

Amend Steps 3, 4, and 6 to state that file-level validation yields individual
accepted/rejected results; valid files may receive independent intents while
the aggregate 10-file and remaining-quota checks still reject the full batch
when those aggregate limits are exceeded. Also detect exact duplicate names
within the selection before issuing any conflicting intent.

**Expected Impact**

Clarifies transport and UI contracts without altering the approved limits or
adding infrastructure.

**Resolution**

Accepted. The plan now specifies individual accepted/rejected outcomes,
independent intents for valid files, full-batch rejection only for aggregate
limits, and within-selection duplicate detection.

### [WARNING] Inngest handler authentication is described imprecisely

**Problem**

Step 5 says to expose the Inngest handler through an “authenticated/verified
Next route.” Browser identity authentication is not the correct trust mechanism
for an Inngest webhook; it must use the Inngest SDK handler and event-signature
verification.

**Impact**

An implementation could accidentally require a browser session for background
events or expose a general route without provider-request verification.

**Resolution**

Amend Step 5 to specify an Inngest `serve` route protected by Inngest signing
keys and framework verification, separate from authenticated browser upload
intent/completion routes. Test rejected unsigned/invalid event requests.

**Expected Impact**

Removes an integration ambiguity and makes the worker boundary secure and
testable.

**Resolution**

Accepted. Step 5 now requires an Inngest SDK-served, signature-verified route
that is separate from authenticated browser endpoints.

### [WARNING] Folder-to-workspace integrity needs a concrete database constraint

**Problem**

The plan correctly identifies that an authorized service lookup is insufficient
on its own, then says a composite database relation/constraint should be used
“where practical.” This is not a decision: `Document.folder_id` and
`Document.workspace_id` can otherwise reference mismatched rows if another
server path or future migration writes directly.

**Impact**

A corrupt relation could surface a document in one workspace while its folder
belongs to another, undermining ownership and cascade assumptions.

**Resolution**

Amend Step 2 to make this invariant mandatory using a composite unique key on
`folders(id, workspace_id)` and a composite foreign key from
`documents(folder_id, workspace_id)` (or an equivalent trigger/check strategy
that PostgreSQL can enforce). Retain service validation for safe errors.

**Expected Impact**

Adds one explicit migration constraint and corresponding migration/integration
tests; no user-facing scope changes.

**Resolution**

Accepted. The plan now requires a composite database foreign key for every
folder-targeted document while retaining nullable folders for direct workspace
uploads.

## Acceptance Criteria Coverage

- Upload one to 10 supported files to workspace root/folder → Steps 2, 3, 4,
  5, 6, 7.
- Reject more than 10 files or files over 10 MB → Steps 3, 4, 6, 7.
- Reject unsupported types clearly → Steps 1, 3, 4, 5, 6, 7.
- Processing success produces available document → Steps 2, 5, 6, 7.
- Processing failure is clearly failed and retryable → Steps 3, 5, 6, 7.
- Retry without re-upload → Steps 3, 5, 6, 7.
- Exact duplicate-name rejection in one location → Steps 2, 3, 4, 6, 7.
- Case-only filename variants coexist → Steps 2, 3, 7.
- Cross-user upload/view/retry/delete denial → Steps 2, 3, 4, 6, 7.
- Individual deletion cancellation → Steps 3, 6, 7.
- Document/folder/workspace deletion removes records and source objects →
  Steps 2, 3, 5, 6, 7.
- 100 MB owner quota → Steps 1, 2, 3, 4, 6, 7.

## Remaining Risks

- Storage cleanup is eventually consistent across PostgreSQL and Supabase
  Storage because they cannot share one transaction. The cleanup task/workflow
  design is appropriate, but monitoring and retry retention must be reviewed
  during implementation.
- The 100 MB quota limits retained files but does not itself mitigate endpoint
  request bursts. Deployment-level rate control still needs configuration before
  public exposure, as recorded in the plan.
- `pgvector` dimension, index parameters, embedding model, chunk size, and
  overlap must be selected together during implementation and tested against
  corpus size/quality. CAP-03 should avoid exposing retrieval UI prematurely.
- Live RLS, signed-upload, and workflow testing needs an isolated Supabase and
  Inngest environment; unit mocks alone cannot validate those policies.

## Final Assessment

The plan covers the approved CAP-03 contract, follows current repository
patterns, and has no remaining blockers. All selected corrections have been
incorporated. Implementation may proceed after the required architecture
diagram stage.
