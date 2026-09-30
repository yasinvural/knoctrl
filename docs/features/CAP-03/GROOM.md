## Feature

CAP-03 — Document Upload and Availability

## Goal

Let signed-in users add supported source files to their private workspaces or
folders, understand each file's readiness for grounded questions, and retry a
file that could not be processed.

## Functional Requirements

- Allow a signed-in user to upload DOCX, CSV, PDF, and TXT files to a
  workspace they own, either directly to the workspace or to one of its
  folders.
- An upload may include at most 10 files, and each individual file must not
  exceed 10 MB.
- Limit each user to 100 MB of stored source files across their documents.
  Reject an upload that would exceed the remaining quota before storing it.
- Persist each accepted document with its owner-visible filename, workspace,
  optional folder, upload metadata, processing state, and the private Storage
  object needed to process and later remove it.
- Validate the supported file type and size before treating a selected file as
  an accepted upload. Reject invalid files with a clear per-file error.
- Store accepted files in private Storage and initiate durable background
  processing that extracts usable content and prepares it for semantic
  discovery.
- Display documents in their workspace or folder context with one of these
  states: processing, available, or failed.
- Display a clear, safe failure indication for every file that cannot be
  processed; do not present a failed file as available or searchable.
- Provide a clearly labelled retry icon button for each failed document. A
  retry re-attempts processing of that document without requiring the user to
  select and upload the file again.
- Allow an owner to permanently delete an individual document. Require a
  confirmation prompt that names the document and explains that its stored
  source file will be permanently removed.
- Make only documents in the available state eligible as answer sources for
  later capabilities. Processing and failed documents must be excluded.
- Enforce filename uniqueness within the document's exact location: the
  workspace root or a particular folder. Exact duplicate names in that
  location are rejected. Filename comparison is case-sensitive, so
  `Report.pdf` and `report.pdf` may coexist; documents with the same filename
  in different folders, or in a folder and its workspace root, may coexist.
- Extend the CAP-02 deletion contract: deleting a document removes its
  persisted record and its private Storage object; deleting a folder or
  workspace permanently removes all contained document records and Storage
  objects.

## Acceptance Criteria

- Given an owner selects one to 10 supported files, each no larger than 10 MB,
  when they upload them to their workspace root or a folder in that workspace,
  then each document is persisted in that selected location and initially
  displays as processing.
- Given a user selects more than 10 files or a file larger than 10 MB, when
  they attempt the upload, then the invalid selection is clearly rejected and
  no over-limit file is uploaded.
- Given an upload would make an owner's stored source files exceed 100 MB,
  when the upload is submitted, then it is rejected with a clear quota error
  and no selected file is stored.
- Given a user selects an unsupported file type, when they attempt the upload,
  then that file is rejected with a clear error and is not shown as available.
- Given processing succeeds, when the document list refreshes, then the
  document displays as available and is eligible for later answer grounding.
- Given processing fails, when the document list refreshes, then the affected
  document displays as failed with a clear failure indication, is excluded
  from answer grounding, and offers an accessible retry icon button.
- Given an owner retries a failed document, when retry processing succeeds,
  then it becomes available without uploading the file again.
- Given an owner uploads an exact duplicate filename to the same workspace
  root or the same folder, when the upload is submitted, then it is rejected
  and the existing document remains unchanged.
- Given an owner uploads `Report.pdf` and `report.pdf` to the same location,
  when both uploads are valid, then both documents can be stored and shown.
- Given a user attempts to upload, view, retry, or delete a document in
  another user's workspace or folder, when the request is processed, then no
  private data is disclosed and no change is made.
- Given an owner opens a document deletion confirmation, when they cancel it,
  then the document and its stored source file remain unchanged.
- Given an owner deletes a document, folder, or workspace, when deletion
  completes, then the corresponding private Storage objects and document
  records are permanently removed, and the UI accurately reflects the result.

## Edge Cases

- Files in a mixed selection are independently validated and reported so a
  user can identify which files need correction; an invalid file must not be
  silently accepted as usable.
- A retry is safe to repeat: concurrent or repeated retry requests must not
  create duplicate documents or leave a document in a misleading available
  state.
- Empty files and files without extractable useful content transition to
  failed with a safe, understandable status.
- If a document, folder, or workspace is deleted while processing is queued or
  running, later processing must not restore the deleted document or make it
  available.
- If upload, Storage access, persistence, or background processing fails,
  report a retryable, safe error without exposing storage paths, credentials,
  provider internals, or another user's document information.
- The document list must distinguish individual states when a multi-file
  upload results in a mixture of processing, available, failed, or rejected
  files.

## Non-Functional Requirements

- Authorize every server-side document, upload, retry, and deletion operation
  against the current user and the owning workspace/folder; client-side checks
  are not an authorization boundary.
- Use a private Supabase Storage bucket and owner-scoped database access/RLS
  to prevent cross-user file access. Do not expose service-role credentials,
  Storage paths, or raw provider errors to clients or logs.
- Maintain consistency between document rows, Storage objects, and processing
  jobs, including cleanup for rejected, failed, or deleted documents.
- Validate file-count, size, and type limits at the server boundary as well as
  providing immediate client feedback.
- Enforce the stored-file quota server-side using an authoritative aggregate,
  and keep its value in server configuration so a future product setting can
  change it without changing document data semantics.
- Provide accessible status text, errors, and retry controls; the retry icon
  button must have an accessible name and keyboard operation. Destructive
  document confirmation controls must be keyboard-operable with appropriate
  focus behavior.
- Keep upload and document-list interactions usable at mobile and desktop
  widths. Long filenames must not break the layout.
- Record structured, privacy-safe application and workflow logs for upload,
  processing, retry, and cleanup outcomes.
- Add automated coverage for limit/type validation, scoped filename
  uniqueness, ownership isolation, all processing states, retry behavior,
  unavailable-document exclusion, and document/Storage cascade deletion.

## Dependencies

- CAP-01 Account Access for server-validated identity and protected routes.
- CAP-02 Workspace and Folder Management for owned upload destinations and
  the document cascade-deletion contract.
- Prisma/PostgreSQL migrations for document metadata and `pgvector` data.
- Supabase private Storage bucket and access policies.
- Inngest durable workflows for extraction, embedding, retry, and cleanup.
- OpenAI embeddings API for semantic discovery preparation.

## Assumptions

- "10" in the approved upload limit means a batch contains no more than 10
  files, while the maximum size of each file is 10 MB.
- The initial stored-source-file quota is 100 MB per user. Customizing it is
  intentionally deferred, but the implementation must not hard-code the value
  into document data or client-only validation.
- Filename uniqueness applies to exact, case-sensitive stored filenames within
  a workspace root or individual folder; no cross-location uniqueness is
  required.
- A failed-document retry reuses the private object already stored for that
  document and re-runs processing rather than asking the user to re-upload.
- Individual document deletion follows CAP-02's permanent-deletion behavior:
  it requires confirmation and removes both the document record and private
  Storage object.
- Documents remain in their chosen workspace/folder for this capability;
  moving or renaming documents is not needed.
- A successful upload may remain processing while background work is pending;
  availability does not imply synchronous extraction.

## Out of Scope

- Question-answering UI, retrieval ranking, generated answers, streaming, and
  citations (CAP-04 through CAP-06).
- Moving or renaming documents; folders; bulk document operations; versioning;
  overwrite/update-in-place; and duplicate-content detection.
- Legacy DOC files and files beyond DOCX, CSV, PDF, and TXT, including
  OCR/image ingestion, spreadsheets beyond CSV, archives, and URLs.
- Public file links, downloading/sharing documents, team access, and document
  permissions beyond workspace ownership.
- User-facing/configurable upload quotas, custom file limits, manual
  processing configuration, and a general document recovery/retention system.

## Open Questions
