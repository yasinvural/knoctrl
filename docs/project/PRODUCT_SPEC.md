## Product Overview

KnowledgeControl is a private, document-grounded knowledge assistant for individual knowledge workers and the members of small teams using their own accounts. A user creates workspaces, organizes and uploads documents, and has persistent chats with one or more selected workspaces as the knowledge scope.

The product answers questions using semantic relevance across uploaded DOC, DOCX, CSV, PDF, and TXT files. It streams answers as they are generated, identifies the source files used, and prioritizes honest uncertainty over unsupported claims.

## Product Principles

- **Grounded and verifiable:** An answer must be supported by the selected uploaded sources and expose its supporting source files.
- **Truthful about limits:** When the selected sources do not provide sufficient evidence, the product must say so rather than inventing or supplementing an answer from the public web.
- **Meaning-first discovery:** Users should be able to ask in natural language without knowing the exact wording in their documents.
- **Private by default:** In the MVP, a user can access only their own workspaces, files, and chat history.
- **Low-friction continuity:** Users can return to saved chats and continue working without recreating context.

## User Types

### Individual User

The sole MVP user type. An individual user owns private workspaces, their contents, and their chat history. This represents both independent users and a member of a small team working with their own account until shared workspaces are introduced.

## Core User Journeys

### Create an Account and Start a Workspace

1. A new user registers for an account.
2. The user signs in.
3. The user creates a private workspace for a knowledge domain or project.
4. The user optionally creates folders to organize its documents.

### Add Documents to a Workspace

1. The user opens one of their workspaces or a folder within it.
2. The user uploads one or more supported files.
3. The product communicates whether each file is ready for questions or could not be processed.
4. Once ready, the document becomes available as a possible answer source within its workspace.

### Ask a Grounded Question

1. The user starts a chat and selects one or more of their workspaces as its knowledge scope.
2. The user submits a natural-language question.
3. The product finds relevant content by meaning across the selected sources.
4. The product streams a grounded response as it becomes available.
5. The user sees the source file or files cited in support of the response.
6. If no reliable supporting information is available, the product clearly says so.

### Resume a Previous Conversation

1. The user views their saved chats.
2. The user opens an earlier chat and reviews its prior messages and citations.
3. The user submits a follow-up question.
4. The product uses the chat’s selected workspace scope and conversation context to provide a new grounded response.

### Work Across Knowledge Domains

1. The user creates separate workspaces for distinct projects or collections of knowledge.
2. The user starts a chat scoped to a single workspace when a question concerns one domain.
3. The user selects multiple workspaces when a question needs information from more than one domain.
4. The response cites the contributing file or files, including sources from multiple workspaces when applicable.

## Domain Concepts

### User

A registered account holder who owns and accesses private workspaces, documents, and chats in the MVP.

### Workspace

A user-owned private knowledge area that groups documents and may serve as a source scope for a chat.

### Folder

An optional organizational container within a workspace for documents. Folders help users navigate their knowledge but do not create a separate access boundary in the MVP.

### Document

An uploaded DOC, DOCX, CSV, PDF, or TXT file belonging to one workspace and optionally placed in a folder. A document has a user-visible processing availability state.

### Document Processing State

The user-visible status indicating whether an uploaded document is awaiting processing, available for questions, or unavailable due to a processing failure.

### Chat

A saved, user-owned conversation associated with one or more selected workspaces. Its scope determines the documents eligible to support its answers.

### Message

A saved user question or assistant response within a chat. Assistant responses may include citations.

### Citation

The provenance attached to an assistant response that identifies an uploaded source file used to support the answer. A response can have zero, one, or multiple citations.

### Grounded Answer

An assistant response based on relevant content from documents in the active chat’s selected workspace scope. It is not an answer based on public-web retrieval or unsupported inference.

## Product Capabilities

### CAP-01 — Account Access

**Purpose**

Give users a persistent private identity through which they can return to their knowledge and conversations.

**User Behavior**

Users can register, sign in, and sign out. A returning user can access their previously created workspaces, documents, and chats.

**Requirements**

- The system must allow a new user to create an account.
- The system must allow a registered user to sign in and sign out.
- The system must restore the signed-in user’s private product data across sessions.

**Business Rules**

- In the MVP, all workspaces, documents, and chats are private to their owner.

**Important Edge Cases**

- Invalid sign-in attempts must not grant access.
- A signed-out user must not be able to view previously loaded private content.

**Dependencies**

None.

**Release Scope**

MVP

### CAP-02 — Workspace and Folder Management

**Purpose**

Let users separate and organize knowledge collections before asking questions.

**User Behavior**

Users can create and view their workspaces and create folders within a workspace for document organization.

**Requirements**

- The system must allow a user to create a workspace.
- The system must show a user their own workspaces.
- The system must allow a user to create folders within a workspace.
- The system must present documents in their workspace and, where applicable, folder context.

**Business Rules**

- A workspace belongs to exactly one user in the MVP.
- A folder belongs to one workspace and cannot be used to organize documents from another workspace.
- Workspace and folder organization must not expose content to other users.

**Important Edge Cases**

- An empty workspace or folder must be usable and clearly indicate that it has no documents yet.
- A workspace without folders must still accept documents.

**Dependencies**

CAP-01 — Account Access.

**Release Scope**

MVP

### CAP-03 — Document Upload and Availability

**Purpose**

Bring the user’s files into a workspace so they can be used as answer sources.

**User Behavior**

Users upload supported files to a workspace or folder and can see whether each file is ready to be used in questions.

**Requirements**

- The system must accept DOC, DOCX, CSV, PDF, and TXT files.
- The system must associate each uploaded document with the chosen workspace and, when selected, a folder.
- The system must process uploaded content so it can be semantically discovered for questions.
- The system must show whether a document is processing, available, or could not be processed.
- The system must exclude unavailable documents from answer grounding until they are available.

**Business Rules**

- A user may upload documents only to workspaces they own.
- Only documents that are available may be considered as answer sources.
- Unsupported file types must not be silently accepted as usable documents.

**Important Edge Cases**

- If a file cannot be read or processed, the user must receive a clear status rather than a false indication that it is searchable.
- If a user asks a question while relevant documents are still processing, the answer must not imply those documents were considered.
- Empty files or files without extractable useful content may be unavailable for grounded answering and must be communicated clearly.

**Dependencies**

CAP-01 — Account Access; CAP-02 — Workspace and Folder Management.

**Release Scope**

MVP

### CAP-04 — Persistent Chat Management and Scope Selection

**Purpose**

Let users create, revisit, and continue knowledge conversations with an explicit document scope.

**User Behavior**

Users can start multiple chats, select one or more of their workspaces for each chat, view prior chats, reopen a chat, and submit follow-up questions.

**Requirements**

- The system must allow a user to create more than one chat.
- The system must associate each chat with one or more selected workspaces.
- The system must show the user’s saved chats and their saved message history.
- The system must let the user reopen and continue a saved chat.
- The system must retain the workspace scope needed to continue a chat consistently.

**Business Rules**

- A chat may only be scoped to workspaces owned by its user.
- Documents outside the selected workspace scope must not be used to answer that chat.
- A chat must have at least one selected workspace before it can be used for document-grounded questioning.

**Important Edge Cases**

- If a workspace in a chat’s scope has no available documents, the user must still receive a clear no-evidence response where appropriate.
- A chat scoped to multiple workspaces must allow an answer to cite one or many contributing files.
- Prior messages and citations must remain visible when a user reopens a chat.

**Dependencies**

CAP-01 — Account Access; CAP-02 — Workspace and Folder Management.

**Release Scope**

MVP

### CAP-05 — Semantic Grounded Question Answering

**Purpose**

Answer a user’s questions from the meaning of relevant content in selected uploaded documents rather than relying on exact-keyword matching.

**User Behavior**

Within an active chat, users submit natural-language questions and receive an answer based on the selected workspaces’ available documents.

**Requirements**

- The system must consider semantically relevant content from available documents in the active chat scope.
- The system must support questions whose wording differs from the wording in a relevant document.
- The system must generate answers only from the active chat’s selected workspace scope.
- The system must save the user’s question and the resulting assistant response in the chat history.

**Business Rules**

- The system must not use public-web sources to fill gaps in the selected documents.
- The system must not present an answer as grounded when no supporting document content was used.
- An answer can be supported by content from one or multiple documents.

**Important Edge Cases**

- When no relevant source content is available, the response must clearly state that the answer cannot be determined from the selected documents.
- When relevant sources conflict, the response must not conceal the conflict; it should identify the differing source support or state that the sources disagree.
- If the question is ambiguous, the product may ask for clarification or provide a qualified response based on the plausible interpretation and its citations.

**Dependencies**

CAP-03 — Document Upload and Availability; CAP-04 — Persistent Chat Management and Scope Selection.

**Release Scope**

MVP

### CAP-06 — Streaming Responses and Citations

**Purpose**

Make answer creation feel responsive and make its evidence easy to verify.

**User Behavior**

Users see an assistant answer appear progressively and can see which uploaded source file or files support the completed answer.

**Requirements**

- The system must progressively display the assistant response while it is being generated.
- The system must associate citations with each completed grounded answer.
- Each citation must identify at least its supporting source file.
- The system must preserve citations with the saved assistant response.
- When no answer can be reliably supported, the system must make that outcome clear instead of showing unsupported citations.

**Business Rules**

- Citations must refer only to files in the active chat’s selected workspace scope.
- The displayed source files must correspond to content used to support the answer.
- Streaming presentation must not cause incomplete response text to be stored as a completed answer after a normal successful completion.

**Important Edge Cases**

- If answer generation stops unexpectedly, the user must not mistake a partial response for a complete, reliably supported answer. In this scenario, the retry button should appear.
- An answer supported by several files must show all material supporting files, not arbitrarily a single source.
- A no-evidence response may have no citations and must explain why.

**Dependencies**

CAP-05 — Semantic Grounded Question Answering.

**Release Scope**

MVP

### CAP-07 — Shared Workspaces and Collaboration

**Purpose**

Enable small teams to build and query knowledge collections together.

**User Behavior**

Users can share a workspace with teammates and collaborate according to assigned access levels.

**Requirements**

- The future product should support inviting collaborators to a workspace.
- The future product should define access boundaries for shared documents and chats.

**Business Rules**

- Collaboration rules must preserve the privacy and source-grounding principles of the product.

**Important Edge Cases**

- Access changes must affect a collaborator’s ability to view workspace content and related chats.

**Dependencies**

CAP-01 — Account Access; CAP-02 — Workspace and Folder Management; CAP-04 — Persistent Chat Management and Scope Selection.

**Release Scope**

POST_MVP

## MVP Definition

- CAP-01 — Account Access
- CAP-02 — Workspace and Folder Management
- CAP-03 — Document Upload and Availability
- CAP-04 — Persistent Chat Management and Scope Selection
- CAP-05 — Semantic Grounded Question Answering
- CAP-06 — Streaming Responses and Citations

Together, these capabilities let a user upload documents, ask semantically matched questions across one or more chosen workspaces, receive a streamed and cited grounded answer, and return later to continue the conversation.

## Post-MVP Capabilities

- CAP-07 — Shared Workspaces and Collaboration, including invitations and access levels.
- Organization administration and management.
- Billing and subscription management.
- Mobile applications.

## Out of Scope

- Public-web search or external-source augmentation.
- Unsupported answers presented as document-grounded or correct.
- Shared workspaces, collaborator invitations, roles, and permission management in the MVP.
- Real-time collaborative editing or simultaneous chat editing.
- Mobile clients in the MVP.
- Billing and payment processing in the MVP.

## Product Dependencies

```text
Account Access
      ↓
Workspace and Folder Management
      ↓
Document Upload and Availability ──→ Persistent Chat Management and Scope Selection
      ↓                                             ↓
      └──────────────────── Semantic Grounded Question Answering
                                                    ↓
                                  Streaming Responses and Citations
```

## Open Product Decisions

None.
