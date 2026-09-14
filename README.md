## Project Summary

KnowledgeControl is a document-grounded knowledge assistant for individuals and small teams. Users create private workspaces, organize and upload documents, then ask questions about the knowledge contained in those documents. The product produces streamed answers supported by clear citations to the source files used.

The first release prioritizes trust: responses must be grounded in uploaded content and clearly acknowledge when the available sources do not support a reliable answer.

## Technology Stack

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

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
