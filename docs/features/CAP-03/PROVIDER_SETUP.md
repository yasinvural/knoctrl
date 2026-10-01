# CAP-03 provider setup

Configure each deployment environment before enabling document uploads.

## Supabase Storage

Create a private bucket named by `DOCUMENTS_BUCKET` (the default is
`documents`). Configure a 10 MB object-size limit and allow only PDF, DOCX,
CSV, and plain-text MIME types. Do not enable public reads. CAP-03's database
migration will apply the owner-scoped Storage policies; deploy it before
allowing uploads.

## OpenAI

Create a server-only API key with embedding access and set `OPENAI_API_KEY`.
Set `OPENAI_EMBEDDING_MODEL` to the embedding model selected for the database
vector dimension. The initial value is `text-embedding-3-small`.

## Inngest

Create an environment-specific Inngest application and set its event and
signing keys as `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`. Keep both keys
server-only. Register the application endpoint once the document workflows
are added in a later CAP-03 step.
