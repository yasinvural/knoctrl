## Feature

CAP-02 — Workspace and Folder Management

## Goal

Let signed-in users create, organize, maintain, and safely remove their
private knowledge collections before using those collections for document
upload and grounded questions.

## Functional Requirements

- Replace the temporary signed-in shell at `/app` with the authenticated
  workspace index. It must list only workspaces owned by the current user and
  provide a way to create a workspace.
- Provide an authenticated application layout with a persistent header. The
  header must include a user badge/control from which the user can sign out.
- Let a user create a workspace by entering a name.
- Let a user open a workspace to a workspace-detail view that shows its
  folders and its document context.
- Let a user rename and delete a workspace they own.
- Let a user create, view, rename, and delete folders within a workspace they
  own.
- Folders are one level deep. A folder cannot contain another folder.
- A workspace can contain zero folders and remains a valid destination for
  future document uploads.
- Show a clear empty state for a workspace with no folders/documents and for a
  folder with no documents.
- Until CAP-03 supplies document records and uploads, the document area is an
  empty, non-uploading context only; it must not imply that uploads are
  available in this feature.
- Require a confirmation prompt before a destructive delete. The prompt must
  name the target and explain that deletion is permanent. When the target has
  contents, it must state the number of affected nested folders and documents.
- Deleting a workspace permanently deletes its folders and all documents in
  that workspace. Deleting a folder permanently deletes documents in that
  folder. CAP-02 has no documents yet, but its data and deletion behavior must
  support this rule when CAP-03 introduces them.
- Workspace names must be unique for their owner. Folder names must be unique
  within their workspace.

## Acceptance Criteria

- Given a signed-in user visits `/app`, when they have workspaces, then they
  see their workspace list and no workspaces belonging to another user.
- Given a signed-in user has no workspaces, when they visit `/app`, then they
  see an understandable empty state and can create their first workspace.
- Given a valid, unused workspace name, when the owner creates it, then it is
  persisted and appears in their workspace list.
- Given a workspace name already used by the signed-in user, when they create
  or rename a workspace to that name, then the change is rejected with a clear
  field-level error and no duplicate workspace is created.
- Given a workspace owned by the user, when they open it, then they see its
  folders, a document-context area, and controls to manage folders and the
  workspace.
- Given a valid, unused folder name in a workspace, when its owner creates it,
  then it is persisted and displayed only in that workspace.
- Given a folder name already present in a workspace, when its owner creates
  or renames a folder to that name, then the change is rejected with a clear
  field-level error and no duplicate folder is created.
- Given a user attempts to access, update, or delete another user's workspace
  or any folder within it, when the request is processed, then no private data
  is disclosed and no change is made.
- Given an owner chooses to rename a workspace or folder and submits a valid
  available name, when the change completes, then the new name is shown in all
  relevant workspace/folder views.
- Given an owner initiates deletion, when they cancel the confirmation, then
  nothing is changed.
- Given an owner confirms deletion of an empty folder or workspace, when the
  operation completes, then the target no longer appears and the user is
  returned to an appropriate remaining view.
- Given a workspace or folder later contains documents, when its owner
  confirms deletion, then its contained folders and documents are permanently
  deleted with it and the confirmation discloses the affected counts.
- Given a signed-in user uses the header badge/control to sign out, when sign
  out succeeds, then their session ends and they are redirected to the public
  experience.

## Edge Cases

- Whitespace-only names are invalid. Leading and trailing whitespace is
  removed before validation and uniqueness checking.
- Name comparison is case-insensitive within its ownership scope, so names
  such as `Research` and `research` are duplicates.
- A workspace may have no folders; folders may have no documents.
- A folder cannot be created beneath another folder or moved to another
  workspace in this release.
- If a target no longer exists when a rename or deletion is submitted, show a
  safe, actionable result and refresh the displayed list/detail rather than
  reporting success.
- If a concurrent create or rename wins the same unique name, show the normal
  duplicate-name error rather than an internal database error.
- If deletion fails, retain the target in the UI, report a retryable safe
  error, and do not show it as deleted.

## Non-Functional Requirements

- Authorize the current user on every server-side workspace and folder read or
  mutation; client-side visibility checks are not an authorization boundary.
- Enforce ownership relationships and scoped name uniqueness in the database,
  not only in the UI. Multi-record cascade deletions must be atomic.
- Do not expose another user's workspace/folder names, IDs, document counts,
  or database errors in pages, actions, or logs.
- Validate mutation input at the server boundary and present safe, accessible
  validation and operation errors. Destructive confirmation controls must be
  keyboard operable with appropriate focus behavior.
- Keep the workspace index and detail views responsive and usable at mobile
  and desktop widths.
- Avoid unbounded loading as a user's workspace list grows; the implementation
  plan must select an appropriate initial listing strategy.
- Add automated coverage for ownership isolation, scoped uniqueness, CRUD,
  cancellation and confirmation of deletion, empty states, and sign-out access
  from the authenticated header.

## Dependencies

- CAP-01 Account Access, including server-validated Supabase identity,
  protected application routing, and sign out.
- Prisma/PostgreSQL migrations for workspace and folder persistence.
- CAP-03 will introduce document persistence and Storage deletion; it must
  implement the document side of CAP-02's approved cascade-deletion contract.

## Assumptions

- `/app` remains the canonical authenticated entry point for this release,
  despite becoming the product's main workspace page.
- Workspace and folder names are limited to 100 characters after trimming;
  this protects list and form usability while accommodating normal knowledge
  collection names.
- Workspace detail pages are routed beneath the authenticated application area
  using the repository's established Next.js App Router conventions.
- Folder ordering and workspace ordering use a simple consistent default;
  user-controlled sorting, pinning, and drag-and-drop are not required.
- The header badge is an account control for sign out, not a profile-management
  feature.

## Out of Scope

- Nested folders, moving folders, drag-and-drop organization, custom sorting,
  pinning, archiving, sharing, team workspaces, roles, invitations, and public
  links.
- Document upload, processing, document move/rename, document browsing beyond
  empty context, and private Storage-object deletion implementation; these are
  CAP-03 responsibilities.
- Undo, recycle bin, soft deletion, retention policies, and restoring deleted
  workspaces, folders, or documents.
- Profile editing, avatars, account settings, and any badge behavior beyond
  access to sign out.

## Open Questions
