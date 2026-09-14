# KnowledgeControl — High-Level Technical Design

> **Status: APPROVED — SENTRY DEFERRED**
>
> This is the approved technical direction for the product. Sentry is intentionally deferred as optional observability tooling for the MVP.

## 1. Technical Drivers

- A browser-based product for individual users, with small-team collaboration deferred until post-MVP.
- Private accounts, workspaces, files, chats, and citations that must remain isolated by user.
- Uploading and processing DOC, DOCX, CSV, PDF, and TXT files.
- Semantic retrieval by meaning rather than exact keyword matching.
- Answers that are grounded only in selected user documents, display source-file citations, and acknowledge missing or conflicting evidence.
- Long-running document extraction, chunking, and embedding work that must not block an upload request.
- Near-real-time streamed answer delivery.
- Persistent relational data: users, workspaces, folders, documents, chats, messages, scopes, processing state, and citations.
- No stated compliance, self-hosting, deployment-region, budget, scale, or team-experience constraints.
- An early-stage architecture should minimize operational overhead while preserving a credible path to growth.

## 2. Architecture Summary

**Recommendation: a modular full-stack monolith with managed background workflows.**

One TypeScript Next.js application provides the browser UI and the authenticated application boundary. It owns the user-facing flows: workspace management, chat scope selection, upload initiation, document status, grounded-answer requests, streamed output, and persistence orchestration.

Supabase provides the managed PostgreSQL database, authentication, and private object storage. PostgreSQL with `pgvector` stores the application’s semantic retrieval data alongside the relational product records. Inngest runs durable asynchronous document-processing workflows. OpenAI provides embeddings and streamed model responses; KnowledgeControl, rather than the model provider, remains responsible for source selection and citation provenance.

This is intentionally not a microservice architecture. The MVP needs one coherent business boundary, not separately deployed domain services. Background processing is the only distinct execution concern because uploads may require lengthy extraction and embedding work.

**Decision type:** `FOUNDATIONAL`

**Why it fits**

- It minimizes codebase and deployment complexity for an early product.
- It keeps authorization and grounded-answer policy in one place.
- It supports durable ingestion without holding a user request open.
- It avoids prematurely operating queues, workers, a separate vector database, or a service mesh.

**Main trade-off**

The design relies on managed providers and keeps multiple product concerns in one deployable application. That is appropriate for the MVP, but provider portability and independently scaled services may become concerns later.

## 3. Technology Stack

| Area                         | Proposed choice                                                                                    | Status         |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | -------------- |
| Language                     | TypeScript                                                                                         | APPROVED       |
| Application architecture     | Modular full-stack monolith                                                                        | APPROVED       |
| Frontend                     | Next.js App Router + React                                                                         | APPROVED       |
| UI styling                   | Tailwind CSS + shadcn/ui components                                                                | APPROVED       |
| Backend/application boundary | Next.js server-side application layer and route handlers                                           | APPROVED       |
| Primary database             | Supabase PostgreSQL                                                                                | APPROVED       |
| Semantic retrieval           | PostgreSQL `pgvector` in Supabase                                                                  | APPROVED       |
| Data access                  | Prisma ORM + Prisma Migrate for relational data; server-side Supabase clients for Auth and Storage | APPROVED       |
| Authentication               | Supabase Auth, initially email/password sessions                                                   | APPROVED       |
| File storage                 | Supabase Storage private bucket                                                                    | APPROVED       |
| Background processing        | Inngest durable workflows                                                                          | APPROVED       |
| AI generation and embeddings | OpenAI Responses API and embeddings API                                                            | APPROVED       |
| Answer streaming             | Server-to-browser SSE through the Next.js application                                              | APPROVED       |
| Testing                      | Vitest + Playwright                                                                                | APPROVED       |
| Error monitoring             | Sentry                                                                                             | DEFERRED       |
| Logs                         | Structured application and workflow logs                                                           | APPROVED       |
| Deployment                   | Vercel for the Next.js application; managed Supabase, Inngest, and OpenAI services                 | APPROVED       |

## 4. Technology Decisions

### Application Architecture

**Recommendation**

Use a modular full-stack monolith: one Next.js deployment with clear feature/application boundaries, plus managed asynchronous workflows for document ingestion.

**Why**

The MVP’s workflows are tightly connected: authorization determines workspace access; workspace scope controls retrieval; retrieval determines citation eligibility; and the chat response must be persisted. Keeping these in one application reduces cross-service policy drift and deployment overhead.

**Alternatives Considered**

- **Separate frontend and API service:** useful when teams deploy independently or expose a public API, neither of which is required for the MVP. It adds deployment, authentication, and versioning overhead.
- **Microservices:** could isolate ingestion or chat later, but is unjustified before there is independent scale or ownership.
- **Fully serverless functions without a workflow service:** simple at first, but unreliable for potentially long document-processing work and retries.

**Trade-offs**

- Application code and HTTP behavior share one deployment lifecycle.
- A later high-volume ingestion workload may warrant a separately deployed worker.

**Decision type:** `FOUNDATIONAL`

### Frontend and Application Boundary

**Recommendation**

Use TypeScript with Next.js App Router and React. Use server-rendered screens where appropriate, client-side interaction only where needed, and Next.js route handlers/server-side application code for privileged operations.

**Why**

The MVP needs authenticated application pages, responsive navigation, upload interactions, chat UI, and streamed answer delivery. The App Router supports server rendering and route handlers in one project; route handlers use standard web request and response APIs. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

**Alternatives Considered**

- **React SPA plus a separate API:** increases the number of deployables and authentication boundary complexity without a current product need.
- **Remix:** a capable full-stack alternative, but does not provide a meaningful product-specific advantage over the proposed path.

**Trade-offs**

- The product becomes coupled to Next.js conventions.
- Team members need comfort with client/server rendering boundaries.

**Decision type:** `FOUNDATIONAL`

### Database and Semantic Retrieval

**Recommendation**

Use Supabase PostgreSQL as the primary database and `pgvector` in that same database for document-chunk embeddings and similarity retrieval.

**Why**

KnowledgeControl needs relational integrity, user isolation, persistent chats, document lifecycle state, and semantic search. PostgreSQL fits the relational product data; colocating vectors avoids a second data store and keeps source metadata, workspace constraints, and retrieval under one transactional ownership boundary. Supabase supports PostgreSQL extensions including `pgvector` and provides managed backups. [Supabase Database](https://supabase.com/docs/guides/database/overview) [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns)

**Alternatives Considered**

- **Dedicated vector database:** may become worthwhile for larger corpora or specialized retrieval needs, but introduces a second system and synchronization work too early.
- **OpenAI hosted file search:** reduces retrieval implementation work but weakens direct control of workspace filtering, stored chunks, citation provenance, and future provider flexibility.
- **Traditional full-text search alone:** does not meet the semantic-retrieval requirement.

**Trade-offs**

- Very large corpus scale may later require retrieval optimization or a specialized search service.
- `pgvector` retrieval must be carefully filtered by the active chat’s authorized workspace scope before candidates are used.

**Decision type:** `FOUNDATIONAL`

### Data Access and Migrations

**Recommendation**

Use Prisma ORM and Prisma Migrate for KnowledgeControl's relational application data and database migrations. Use server-side Supabase clients only for Supabase Auth and private Storage operations. For `pgvector`-specific storage and similarity queries, use Prisma's supported PostgreSQL extension path or narrowly scoped database-specific queries where the ORM abstraction is insufficient.

**Why**

Prisma provides a type-safe data-access layer and a repeatable migration workflow for the product's relational concepts: workspaces, folders, documents, chats, messages, scopes, processing states, and citations. Both Supabase PostgreSQL and Neon are officially supported Prisma targets. [Supabase + Prisma](https://supabase.com/docs/guides/database/prisma) [Prisma PostgreSQL support](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql)

`pgvector` is a PostgreSQL extension, so vector types and similarity operations must retain a deliberate database-specific boundary rather than being forced through ordinary relational ORM operations. Prisma supports PostgreSQL extensions, including a `pgvector` extension path. [Prisma extensions](https://www.prisma.io/docs/orm/extensions/using-extensions)

**Alternatives Considered**

- **Supabase client for all database access:** simple for small applications, but less suitable as the primary data-access boundary for a relational product with growing domain complexity.
- **Raw SQL for all database access:** maximally expressive but gives up Prisma's model typing and migration ergonomics for ordinary product data.

**Trade-offs**

- Prisma adds a schema and generation layer to maintain.
- Vector retrieval remains intentionally PostgreSQL-specific rather than completely ORM-agnostic.

**Decision type:** `FOUNDATIONAL`

### Authentication and Authorization

**Recommendation**

Use Supabase Auth with email/password sign-up and sign-in for the MVP, backed by server-validated sessions. Enforce private ownership at every application operation and with PostgreSQL Row Level Security (RLS) on user-owned data and stored files.

**Why**

The product requires persistent, private accounts but does not require enterprise identity, organizations, or social sign-in at launch. Supabase Auth reduces identity-management work, while RLS provides a database-level guardrail for user-scoped data. Supabase Storage is designed to use RLS policies and denies storage access by default until policies allow it. [Supabase Auth](https://supabase.com/docs/guides/auth) [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

**Alternatives Considered**

- **Auth.js with a custom identity setup:** flexible but creates more authentication and credential-management responsibility.
- **Clerk:** polished developer experience but adds another managed service where Supabase already supplies the required capability.

**Trade-offs**

- The MVP begins with a narrower sign-in experience.
- Correct RLS policy design is security-sensitive and must be tested as a first-class product boundary.

**Decision type:** `FOUNDATIONAL`

### File Storage

**Recommendation**

Store original uploaded documents in a private Supabase Storage bucket. Store document metadata, ownership, workspace association, folder association, and processing state in PostgreSQL.

**Why**

Original documents are large binary assets and should not be stored in relational rows. Private object storage separates binary lifecycle from metadata while retaining the same user authorization model.

**Alternatives Considered**

- **Amazon S3 or Cloudflare R2:** viable object storage choices, but add provider and authorization integration work without a current benefit.
- **Database binary storage:** makes routine database operations, backups, and growth less suitable for user documents.

**Trade-offs**

- Storage and database backups must be treated as separate operational concerns.
- File type, size, and extraction safety limits must be chosen during feature grooming before implementation.

**Decision type:** `FOUNDATIONAL`

### Background Processing

**Recommendation**

Use Inngest durable workflows for document extraction, text normalization, chunking, embedding generation, and document availability-state updates.

**Why**

These steps may take longer than a browser request and need retries and visible failure outcomes. Inngest supports background jobs and durable workflows from a Next.js application without operating a separate queue/worker fleet. [Inngest background jobs](https://www.inngest.com/docs/guides/background-jobs) [Inngest Next.js quick start](https://www.inngest.com/docs/getting-started/nextjs-quick-start)

**Alternatives Considered**

- **Synchronous processing during upload:** risks timeouts and poor user feedback.
- **A self-managed queue and worker:** gives maximum control but adds operational work and is not needed at MVP scale.
- **Trigger.dev:** a reasonable comparable managed workflow option; Inngest is preferred here for its direct event-driven workflow model and supported Next.js integration.

**Trade-offs**

- Document availability becomes eventually consistent: users may need to wait before a newly uploaded file is eligible for answers.
- A managed workflow service adds vendor dependency.

**Decision type:** `REVERSIBLE`

### AI, Retrieval, and Grounding

**Recommendation**

Use OpenAI embeddings to represent document chunks and user questions for semantic retrieval, then use the OpenAI Responses API to generate grounded answer text from only the retrieved, authorized chunks. The application must construct and persist citations by mapping selected chunks back to their stored source document records.

**Why**

This directly supports the product’s meaning-first search and near-real-time output. The Responses API supports streamed events; the embeddings API provides vector representations for semantic similarity. [OpenAI streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses) [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)

**Grounding boundary**

- The application retrieves only chunks from documents that are available and belong to the active chat’s selected workspaces.
- The model receives that controlled source context and explicit instructions to state when evidence is insufficient or contradictory.
- The application saves which source chunks supported a response and displays their parent source files as citations.
- No public-web retrieval or external knowledge source is enabled for MVP answers.
- The model output never decides whether a user is authorized to access a source; authorization happens before retrieval.

**Alternatives Considered**

- **Anthropic generation plus another embedding provider:** viable for provider diversification, but increases initial integration and evaluation work.
- **OpenAI hosted file search:** reduces ingestion work but gives less direct control over workspace-isolated retrieval and product-owned citation behavior.
- **Self-hosted models:** may be appropriate for later privacy or cost constraints, but adds substantial operations and model-quality risk with no stated requirement.

**Trade-offs**

- AI-provider cost, availability, and behavior affect the product.
- Semantic retrieval and prompting reduce hallucination risk but do not prove factual correctness; the product must preserve citations and explicitly handle insufficient evidence.

**Decision type:** `FOUNDATIONAL`

### Answer Streaming

**Recommendation**

Stream generated answer events from the OpenAI integration through the Next.js application to the browser. Persist a message as complete only after normal generation completion; visibly identify interrupted messages and offer retry.

**Why**

The product requires near-real-time responses, and the web stack supports streamed responses end to end. Vercel supports streamed function responses; infrastructure must not buffer this path. [Vercel streaming functions](https://vercel.com/docs/functions/streaming-functions)

**Alternatives Considered**

- **WebSockets:** useful for bidirectional or collaborative live systems, but adds connection management and is unnecessary for one-way answer token streaming.
- **Polling:** simpler conceptually but provides an inferior response experience and does not meet the intended streaming behavior.

**Trade-offs**

- Network interruptions require careful UI and persistence handling.
- Streaming must be verified in each target deployment environment.

**Decision type:** `REVERSIBLE`

### Deployment, Testing, and Observability

**Recommendation**

Deploy the Next.js application to Vercel. Use managed Supabase, Inngest, and OpenAI services. Establish Vitest for unit/integration testing, Playwright for critical browser journeys, structured logs for application/workflow events, and Sentry for error monitoring.

**Why**

This is the lowest-operations deployment path compatible with server-side authentication, background workflows, file storage, and streamed responses. Automated tests and production error visibility are essential because privacy and grounding failures are core product risks.

**Alternatives Considered**

- **Self-hosting Next.js in a container:** viable when deployment-region or provider-control requirements emerge, but adds infrastructure management. Next.js supports self-hosted streaming if proxies preserve streamed responses. [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- **Cloud-provider-native deployment:** potentially appropriate at larger scale or under specific compliance constraints, but premature without those constraints.

**Trade-offs**

- The launch platform is vendor-managed.
- Costs are distributed across multiple managed services and must be monitored from the beginning.

**Decision type:** `REVERSIBLE`

## 5. High-Level Architecture

**Diagram assumptions:** This is a lightweight, C4-inspired container diagram for a future system. It assumes one web application deployment, managed services, and no enterprise self-hosting or regional-residency requirement in the MVP.

```text
                                 uses
+------------------+  HTTPS  +------------------------------+
| Individual User  | ------> | KnowledgeControl Web App      |
|                  | <------ | Next.js: UI + application     |
+------------------+         | boundary + answer streaming   |
                             +-------+------------+---------+
                                     |            |
                    authenticated   |            | starts/monitors
                    data + files    |            v
                                     |   +-------------------------+
                                     |   | Inngest Workflows        |
                                     |   | extraction / chunking /  |
                                     |   | embeddings / retries     |
                                     |   +------------+------------+
                                     |                |
                                     v                v
                       +---------------------+  +------------------+
                       | Supabase            |  | OpenAI API       |
                       | Auth / PostgreSQL / |  | embeddings /     |
                       | pgvector / Storage  |  | streamed answers |
                       +---------------------+  +------------------+
```

**Key boundaries**

- The browser never receives database credentials, AI credentials, service-role credentials, or authorization bypasses.
- The web application is the trusted policy boundary for upload initiation, chat scope validation, retrieval orchestration, grounded-answer prompts, and citation persistence.
- Supabase owns persisted account identity, relational product state, vectors, and original private documents; RLS provides a second authorization boundary.
- Inngest owns durable execution and retry orchestration, not product authorization rules.
- OpenAI receives only the text necessary for embeddings or the authorized retrieved context necessary to answer a question.

## 6. Component Responsibilities

### Browser Client

Responsible for rendering product screens, collecting user interactions, showing upload/document status, selecting chat workspaces, displaying persisted history and citations, and progressively rendering streamed answer text.

It is not responsible for private authorization decisions, database access, source selection, or secret handling.

### Next.js Application

Responsible for authenticated request handling, product business rules, validating workspace ownership and chat scope, orchestrating file-upload lifecycle, starting workflows, retrieving authorized semantic matches, constructing grounded-answer requests, streaming results, and persisting messages/citations.

It is not responsible for long-running extraction work or independently serving as a general-purpose public API in the MVP.

### Supabase Auth

Responsible for account lifecycle and signed-in session identity.

It is not responsible for product-level workspace or chat authorization rules beyond providing the authenticated identity used to apply them.

### Supabase PostgreSQL and `pgvector`

Responsible for durable relational product state, data integrity, retrieval vectors, source-to-chunk provenance, and database-level user isolation policies.

It is not responsible for original binary file storage or model inference.

### Supabase Storage

Responsible for private storage and controlled access to original uploaded files.

It is not responsible for document processing or semantic retrieval.

### Inngest Workflows

Responsible for reliable asynchronous ingestion stages, retry behavior, processing-state transitions, and failure reporting back to the product data store.

It is not responsible for accepting browser traffic or deciding whether a user can access a document.

### OpenAI API

Responsible for producing embeddings and streamed generative text from the context sent by the application.

It is not responsible for user identity, workspace access, source authorization, citation persistence, or public-web search in this product.

## 7. Data Strategy

Use PostgreSQL as the single primary system of record for structured product data and semantic retrieval metadata.

- Persist user-scoped workspace, folder, document, chat, message, chat-to-workspace scope, document-processing, source-chunk, and citation concepts relationally.
- Keep original binary documents in private object storage, referenced by durable metadata rather than stored in database rows.
- Store extracted text and chunk-level source provenance so every retrieved result can be traced to its parent document.
- Store an embedding for each eligible source chunk in `pgvector`, with the metadata needed to constrain retrieval to the current user and selected workspace set.
- Use Prisma as the ordinary relational data-access and migration boundary; isolate vector-extension operations behind a focused retrieval boundary.
- Preserve assistant-message citations as durable provenance rather than recomputing historical citations from future retrieval results.
- Make document processing state explicit. Only available documents and chunks are eligible for answer retrieval.
- Enforce cross-user isolation in both application-level authorization and database/storage policies.

This design intentionally does not define database tables, columns, indexes, queries, or API contracts; those belong to feature-level planning.

## 8. Authentication and Security

- Use authenticated Supabase sessions; validate the current user identity on all server-side product operations.
- Apply ownership checks to every workspace, folder, document, chat, message, and citation operation.
- Apply RLS to user-owned database data and private storage objects. The application must not rely solely on UI filtering for privacy.
- Keep all privileged provider keys and service credentials server-side only.
- Use private file storage; provide access only through authenticated, authorized server-mediated or time-limited flows.
- Validate file type and size before accepting uploads. Treat parser input as untrusted content.
- Record and surface document-processing failures without exposing sensitive internal error detail to users.
- Ensure retrieval applies chat workspace scope and user ownership before content is sent to the AI provider.
- Do not enable public-web search, external connectors, or model tools in the MVP answer flow.
- Add rate limiting and abuse controls around authentication, uploads, and answer generation during implementation planning.

## 9. External Integrations

| Integration         | Purpose                                  | Direction                           | Failure considerations                                                                                                              |
| ------------------- | ---------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth       | Account and session identity             | Application ↔ Supabase              | Sign-in failures should remain clear; product data must stay inaccessible without a valid session.                                  |
| Supabase PostgreSQL | Product data and semantic vectors        | Application/workflows ↔ Supabase    | Transaction or connectivity failures must not create false document-ready or answer-complete states.                                |
| Supabase Storage    | Private source document storage          | Application ↔ Supabase              | Upload/storage failure must leave a clear unavailable state and not start invalid processing.                                       |
| Inngest             | Durable document-processing workflows    | Application → Inngest → workflows   | Retries must be safe; repeated events must not create duplicate usable source content.                                              |
| OpenAI              | Embeddings and grounded streamed answers | Application/workflows → OpenAI      | Provider failure, rate limits, or interrupted streams must produce recoverable user-visible states; no unsupported fallback answer. |
| Vercel              | Web application hosting                  | Browser ↔ Vercel-hosted application | Confirm end-to-end streaming behavior; deploy failures must not affect managed data integrity.                                      |
| Sentry              | Error monitoring                         | Application/workflows → Sentry      | Avoid sending sensitive document content, raw prompts, or credentials in monitoring events.                                         |

## 10. Background Processing

Document ingestion is asynchronous because file reading and semantic preparation can be slow, fail independently, and need retry behavior.

1. The application validates an authorized upload and stores the original file in private storage.
2. The product records that the document is awaiting processing and starts a durable workflow.
3. The workflow obtains the private source file through authorized server-side access.
4. It extracts usable text, normalizes it, splits it into traceable source chunks, generates embeddings, and records completed semantic availability.
5. If any stage cannot produce usable content, the workflow records an unavailable/failed state that the user can understand.
6. Only completed, available documents may participate in semantic retrieval.

The workflow must be idempotent at the product level: retries and duplicate triggers must not create duplicate chunks or duplicate usable document versions.

## 11. Testing Strategy

- **Unit tests:** source-scope validation, ownership rules, document state transitions, citation selection/mapping, grounding-policy construction, and interruption-state behavior.
- **Integration tests:** authenticated persistence behavior, RLS-sensitive data isolation, private storage access, workflow state updates, retrieval restricted to selected workspaces, and provider-adapter error handling.
- **Browser acceptance tests (Playwright):** register/sign in; create workspace/folder; upload and view document status; create/reopen multi-workspace chats; receive a streamed cited answer; see no-evidence and retry states.
- **Contract/adaptor tests:** isolate OpenAI, Inngest, and Supabase integration contracts so provider changes are detected early.
- **Manual evaluation set:** maintain a small curated set of documents and questions that exercises citation correctness, insufficient-evidence refusal, conflicting sources, and semantically paraphrased queries.

## 12. Deployment Strategy

- Deploy the single Next.js application to Vercel.
- Run Supabase as the managed database, authentication, and private object-storage platform.
- Run document-processing workflows through managed Inngest.
- Use OpenAI as the external AI provider.
- Maintain separate development, preview, and production environments with separate credentials and isolated data.
- Apply database migrations and authorization-policy changes through a reviewed, repeatable deployment process.
- Confirm that the production path supports streamed HTTP responses without buffering.

No container orchestration, self-managed database cluster, self-managed worker fleet, cache cluster, or separate search cluster is part of the initial deployment.

## 13. Observability

The MVP should establish a minimal but meaningful operational view:

- Structured logs with request/workflow correlation identifiers, user-safe document identifiers, processing transitions, retrieval counts, and answer-completion status.
- Error monitoring with Sentry for browser, application, and workflow failures, configured to redact document contents, secrets, and sensitive prompt data.
- Basic operational metrics: upload acceptance/failure, processing success/failure/latency, document-ready rate, answer success/interruption/no-evidence rate, retrieval latency, and AI-provider error/rate-limit rate.
- An audit-friendly record of which source files were cited by completed answers.

## 14. Initial Project Structure

```text
src/
  app/                 # Routes, layouts, and request handlers
  features/            # Product areas: auth, workspaces, documents, chats, answers
  components/          # Reusable UI primitives and composed presentation
  server/              # Application policies, service adapters, retrieval orchestration
  db/                  # Database access, migrations, and generated types
  integrations/        # Supabase, OpenAI, Inngest, and observability adapters
  inngest/             # Background workflow definitions
  shared/              # Cross-boundary types, validation, and utilities
tests/
  unit/
  integration/
  e2e/
docs/
  project/
```

This is an initial organizational direction, not a commitment to every future directory or file.

## 15. Risks and Trade-offs

| Risk or trade-off                  | Why it matters                                               | Initial mitigation                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Unsupported AI answers             | Trust is the primary product promise.                        | Retrieve only authorized source chunks, instruct the model to use them, persist citations, and provide a no-evidence outcome. |
| Citation mismatch                  | A cited file might not actually support a claim.             | Derive citations from the exact retrieved chunk provenance; include citation correctness in the evaluation set.               |
| Prompt injection in uploaded files | Untrusted document text may attempt to alter model behavior. | Treat source content as data, clearly separate it from instructions, restrict tools, and do not enable web search.            |
| Document parser variation          | DOC, DOCX, CSV, PDF, and TXT quality differs.                | Make processing state explicit; report unavailable files; create feature-level acceptance tests by file type.                 |
| Provider cost and rate limits      | Embeddings and generated answers have variable usage costs.  | Track usage/error metrics, enforce product limits when requirements define them, and keep adapters provider-specific.         |
| Managed-service dependency         | Core functionality depends on several vendors.               | Encapsulate provider integrations and retain canonical product data/citations in PostgreSQL.                                  |
| RLS policy mistakes                | A mistake could expose another user’s private data.          | Test negative authorization paths, review policy changes, and enforce application ownership checks in addition to RLS.        |
| Eventual document readiness        | Newly uploaded files cannot be queried immediately.          | Present clear processing/available/failed states and exclude incomplete documents from answers.                               |
| Stream interruption                | Users can confuse partial output for a complete answer.      | Persist completion state, show interruption clearly, and offer retry.                                                         |

## 16. Evolution Strategy

These are future possibilities, not MVP commitments:

- Add shared workspace membership and roles by extending the ownership/access model, RLS policies, and chat/source authorization checks.
- Introduce a dedicated worker deployment if ingestion workload or execution requirements exceed managed workflow limits.
- Add a specialized search/vector service only when corpus size, query latency, or retrieval quality demonstrates a need beyond PostgreSQL `pgvector`.
- Add caching for repeated metadata and retrieval work only after observing measurable bottlenecks.
- Add direct cloud storage, self-hosted application deployments, or region-specific infrastructure when customer privacy, compliance, cost, or residency needs require them.
- Add alternative AI providers behind existing integration boundaries if quality, cost, availability, or customer requirements justify it.
- Split bounded parts of the monolith only when independent deployment, ownership, or scaling need is demonstrated.

## 17. Rejected Alternatives

| Alternative                                          | Reason not selected for the MVP                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Microservices                                        | More operational and policy-boundary complexity than the product’s current scale requires.                                  |
| Separate frontend and backend projects               | No current need for a public API or independently deployed clients; it adds authentication and release coordination.        |
| Dedicated vector database                            | A second data store and synchronization path are unnecessary while PostgreSQL `pgvector` meets the semantic-retrieval need. |
| Full-text-only search                                | Does not satisfy the explicit semantic-search requirement.                                                                  |
| OpenAI hosted file search                            | Reduces product control over workspace isolation, retrieval behavior, and citation provenance.                              |
| Synchronous document processing                      | Creates avoidable timeouts and poor feedback for long-running or failed processing.                                         |
| WebSockets for answer streaming                      | Adds connection complexity when server-to-browser HTTP streaming is sufficient for the MVP.                                 |
| Self-hosted AI models                                | Adds model operations, hardware, and quality risks without a stated privacy or cost requirement.                            |
| Kubernetes / Kafka / Redis / Elasticsearch at launch | No demonstrated MVP need justifies their operational cost and complexity.                                                   |

## 18. Review Updates

- **Approved:** Tailwind CSS with shadcn/ui components for UI styling.
- **Approved:** Prisma ORM and Prisma Migrate for relational data access and migrations.
- **Approved:** Supabase is the PostgreSQL provider because its free tier includes a database, Auth, private Storage, and RLS access controls. Its current free tier includes 500 MB database storage, 1 GB file storage, and 50,000 MAUs, but pauses inactive projects after one week. [Supabase pricing](https://supabase.com/pricing)
- **Reviewed alternative:** Neon supports PostgreSQL, `pgvector`, Prisma, and Neon Auth. Its current free tier includes 0.5 GB storage, 100 CU-hours per project each month, and up to 60,000 Neon Auth MAUs. For KnowledgeControl, it would still require a separate private object-storage provider for uploaded documents; its compute can also cold-start after idling. [Neon pricing](https://neon.com/pricing) [Neon pgvector](https://neon.com/docs/ai/ai-concepts)
- **Clarified:** The proposed answer stream is server-to-browser SSE (`text/event-stream`), not a WebSocket or a database-realtime channel.
- **Approved:** Modular Next.js/TypeScript monolith, OpenAI, Vercel, email/password authentication, Inngest, Vitest, and Playwright.
- **Deferred:** Sentry is optional and is not part of the MVP baseline.

## 19. Open Technical Decisions

None. The high-level technical direction is approved.

File-size limits, document retention/deletion policy, target deployment region, initial usage quotas, and future compliance obligations are feature-planning or pre-production decisions; they do not change the approved MVP architecture.
