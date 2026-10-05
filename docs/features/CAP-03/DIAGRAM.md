# CAP-03 — Lightweight Architecture Diagram

## Containers and Responsibilities

```text
+------------------+ HTTPS +-----------------------------------------+
| Signed-in user   | ----> | Next.js application                      |
| Browser          |       |                                         |
|                  |       | - Workspace document UI                 |
| selects files,   |       | - Upload-intent / completion endpoints  |
| sees statuses,   |       | - Server Actions: retry and delete      |
| retries/deletes  |       | - Owner authorization and validation    |
+------------------+       +------------------+----------------------+
                                               |
                  signed URL                  | Prisma / service role
          +------------------------------------+-------------------+
          |                                                        |
          v                                                        v
+------------------------------+                  +------------------------------+
| Supabase Storage             |                  | Supabase PostgreSQL           |
| private `documents` bucket   |                  | - workspaces / folders        |
| - original source objects    |                  | - documents and byte quota    |
| - owner-prefixed UUID paths  |                  | - cleanup tasks               |
+---------------+--------------+                  | - chunks + pgvector embeddings|
                ^                                 | - RLS and integrity rules     |
                | server-only object read         +---------------+--------------+
                |                                                 ^
                |                                                 |
                |                         writes status/chunks/vectors
                |                                                 |
                |                      +--------------------------+
                |                      |
                v                      v
          +-----------------------------------------+       +------------------+
          | Inngest document-processing workflow    | ----> | OpenAI API       |
          | - receives signed internal event         |       | embeddings only  |
          | - extracts DOCX/CSV/PDF/TXT              |       +------------------+
          | - chunks, embeds, status transitions     |
          | - retry and Storage-cleanup work         |
          +-----------------------------------------+
```

## Asynchronous Upload and Processing Sequence

```text
User             Browser / Next.js            Storage          Inngest / Database
 | select files          |                       |                       |
 |---------------------->| validate each file,   |                       |
 |                       | check target/quota    |                       |
 |                       |-- create intent ----->|                       |
 |                       |<-- signed URL --------|                       |
 |                       |                       |                       |
 |                       |-- direct upload ----->|                       |
 | sees "Processing"    |                       |                       |
 |<----------------------                       |                       |
 |                       |-- completion -------->| verify object +      |
 |                       |                       | enqueue event        |
 |                       |                       |---------------------->|
 | user may leave page   |                       |       extract/chunk/embed
 |                       |                       |                       |
 | later status refresh  |<-------------------------------------- available
 |<----------------------|                       |       or failed
```

## Notes

- Original files never pass through a Server Action or live in PostgreSQL.
  The browser uploads directly to private object storage with a narrowly scoped
  signed URL.
- The browser request finishes once the upload is safely accepted and the
  processing event is queued. Extraction and embeddings continue independently;
  a user can navigate away and later observe `available` or `failed` status.
- Only Inngest's signature-verified route can start background processing.
  Browser endpoints independently require the current Supabase user and
  validate the workspace/folder relationship.
- PostgreSQL is the source of truth for document state. A document only becomes
  `available` after its chunks and embeddings have been committed. `processing`
  and `failed` documents are excluded from later retrieval.
- Document deletion revokes database visibility first and uses durable cleanup
  work to remove the corresponding private object safely despite the database
  and object store not sharing one transaction.

## Assumptions and Open Questions

- Supported initial formats are DOCX, CSV, PDF, and TXT. Legacy DOC is
  explicitly deferred.
- A signed-in user may upload to a workspace root or an existing folder. A
  database composite foreign key prevents a folder from a different workspace
  being assigned to the document.
- The initial retained-source quota is 100 MB per user, configured server-side
  for future customization.
- Processing-status updates are planned as periodic refreshes while documents
  are processing; Supabase Realtime is not required for this capability.
- A deployment-level request-rate policy for public upload endpoints remains
  to be configured before public release; no unapproved numeric rate has been
  chosen.
