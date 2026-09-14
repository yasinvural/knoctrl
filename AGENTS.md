# Project overview

KnowledgeControl is a document-grounded knowledge assistant for individuals and small teams. Users create private workspaces, organize and upload documents, then ask questions about the knowledge contained in those documents. The product produces streamed answers supported by clear citations to the source files used. The first release prioritizes trust: responses must be grounded in uploaded content and clearly acknowledge when the available sources do not support a reliable answer.

# Code Style Guidelines

Before writing or modifying the code, read the `docs/code-style-guidelines.md` and follow the conventions defined there.

# Project & Technology Structure

Explain the folder structure, the tech stack and the important packages used in the project.

| Area                         | Proposed choice                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Language                     | TypeScript                                                                                         |
| Application architecture     | Modular full-stack monolith                                                                        |
| Frontend                     | Next.js App Router + React                                                                         |
| UI styling                   | Tailwind CSS + shadcn/ui components                                                                |
| Backend/application boundary | Next.js server-side application layer and route handlers                                           |
| Primary database             | Supabase PostgreSQL                                                                                |
| Semantic retrieval           | PostgreSQL `pgvector` in Supabase                                                                  |
| Data access                  | Prisma ORM + Prisma Migrate for relational data; server-side Supabase clients for Auth and Storage |
| Authentication               | Supabase Auth, initially email/password sessions                                                   |
| File storage                 | Supabase Storage private bucket                                                                    |
| Background processing        | Inngest durable workflows                                                                          |
| AI generation and embeddings | OpenAI Responses API and embeddings API                                                            |
| Answer streaming             | Server-to-browser SSE through the Next.js application                                              |
| Testing                      | Vitest + Playwright                                                                                |
| Error monitoring             | Sentry                                                                                             |
| Logs                         | Structured application and workflow logs                                                           |
| Deployment                   | Vercel for the Next.js application; managed Supabase, Inngest, and OpenAI services                 |

# Workflows

Describe the workflows in the project. Feature workflow for building a new feature from scratch. Bug workflow for fixing a bug.

# Feature workflow

When you receive a feature request, execute the following workflow.

1. `/groom`
2. `/planner`
3. `/validate-plan`
4. `/diagram`
5. `/implementer`
6. `/code-review`
7. `/fix-review-findings`
8. `/test`
9. `/validator`

All stages are required by default. A stage may only be skipped when the user explicitly requests it. Never silently skip a workflow stage.

# Bug workflow
