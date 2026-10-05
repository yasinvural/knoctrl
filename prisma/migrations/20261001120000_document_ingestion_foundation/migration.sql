-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('processing', 'available', 'failed');

-- CreateEnum
CREATE TYPE "StorageCleanupStatus" AS ENUM ('pending', 'completed');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "folder_id" UUID,
    "filename" VARCHAR(255) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'processing',
    "processing_attempt" INTEGER NOT NULL DEFAULT 1,
    "failure_code" VARCHAR(100),
    "failure_message" VARCHAR(500),
    "upload_intent_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6),
    "available_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "documents_file_size_check" CHECK ("file_size" >= 0),
    CONSTRAINT "documents_processing_attempt_check" CHECK ("processing_attempt" > 0)
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "processing_attempt" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_chunks_processing_attempt_check" CHECK ("processing_attempt" > 0),
    CONSTRAINT "document_chunks_sequence_check" CHECK ("sequence" >= 0),
    CONSTRAINT "document_chunks_offsets_check" CHECK ("start_offset" >= 0 AND "end_offset" >= "start_offset")
);

-- CreateTable
CREATE TABLE "document_usages" (
    "owner_id" UUID NOT NULL,
    "stored_bytes" BIGINT NOT NULL DEFAULT 0,
    "reserved_bytes" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_usages_pkey" PRIMARY KEY ("owner_id"),
    CONSTRAINT "document_usages_stored_bytes_check" CHECK ("stored_bytes" >= 0),
    CONSTRAINT "document_usages_reserved_bytes_check" CHECK ("reserved_bytes" >= 0)
);

-- CreateTable
CREATE TABLE "storage_cleanup_tasks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "StorageCleanupStatus" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "storage_cleanup_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "storage_cleanup_tasks_attempt_count_check" CHECK ("attempt_count" >= 0)
);

-- Add the unique key required by the folder/workspace composite relation.
CREATE UNIQUE INDEX "folders_id_workspace_id_key" ON "folders"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");
CREATE INDEX "documents_workspace_id_created_at_id_idx" ON "documents"("workspace_id", "created_at", "id");
CREATE INDEX "documents_folder_id_created_at_id_idx" ON "documents"("folder_id", "created_at", "id");
CREATE INDEX "documents_status_updated_at_idx" ON "documents"("status", "updated_at");
CREATE UNIQUE INDEX "documents_workspace_root_filename_key" ON "documents"("workspace_id", "filename") WHERE "folder_id" IS NULL;
CREATE UNIQUE INDEX "documents_folder_filename_key" ON "documents"("folder_id", "filename") WHERE "folder_id" IS NOT NULL;
CREATE UNIQUE INDEX "document_chunks_document_id_processing_attempt_sequence_key" ON "document_chunks"("document_id", "processing_attempt", "sequence");
CREATE UNIQUE INDEX "storage_cleanup_tasks_storage_key_key" ON "storage_cleanup_tasks"("storage_key");
CREATE INDEX "storage_cleanup_tasks_status_created_at_idx" ON "storage_cleanup_tasks"("status", "created_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_workspace_id_fkey" FOREIGN KEY ("folder_id", "workspace_id") REFERENCES "folders"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma does not model pgvector columns. The embedding dimension must remain
-- aligned with OPENAI_EMBEDDING_MODEL (text-embedding-3-small = 1536).
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "document_chunks" ADD COLUMN "embedding" vector(1536);
CREATE INDEX "document_chunks_embedding_cosine_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE "embedding" IS NOT NULL;

-- Private Storage bucket for original document objects. Bucket policy is
-- owner-scoped; callers must place each object under <owner-id>/<uuid>.
DO $storage_bucket$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE $bucket$
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'documents',
        'documents',
        false,
        10485760,
        ARRAY[
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/csv',
          'text/plain'
        ]::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types
    $bucket$;
  END IF;
END
$storage_bucket$;

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_usages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storage_cleanup_tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_workspace_owner" ON "documents"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "workspaces"
      WHERE "workspaces"."id" = "documents"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "documents_insert_workspace_owner" ON "documents"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "workspaces"
      WHERE "workspaces"."id" = "documents"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "documents_update_workspace_owner" ON "documents"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "workspaces"
      WHERE "workspaces"."id" = "documents"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "workspaces"
      WHERE "workspaces"."id" = "documents"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "documents_delete_workspace_owner" ON "documents"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "workspaces"
      WHERE "workspaces"."id" = "documents"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "document_chunks_select_workspace_owner" ON "document_chunks"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "documents"
      JOIN "workspaces" ON "workspaces"."id" = "documents"."workspace_id"
      WHERE "documents"."id" = "document_chunks"."document_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "document_chunks_insert_workspace_owner" ON "document_chunks"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "documents"
      JOIN "workspaces" ON "workspaces"."id" = "documents"."workspace_id"
      WHERE "documents"."id" = "document_chunks"."document_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "document_chunks_update_workspace_owner" ON "document_chunks"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "documents"
      JOIN "workspaces" ON "workspaces"."id" = "documents"."workspace_id"
      WHERE "documents"."id" = "document_chunks"."document_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "documents"
      JOIN "workspaces" ON "workspaces"."id" = "documents"."workspace_id"
      WHERE "documents"."id" = "document_chunks"."document_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "document_chunks_delete_workspace_owner" ON "document_chunks"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "documents"
      JOIN "workspaces" ON "workspaces"."id" = "documents"."workspace_id"
      WHERE "documents"."id" = "document_chunks"."document_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "document_usages_select_own" ON "document_usages"
  FOR SELECT TO authenticated
  USING ("owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid));

CREATE POLICY "document_usages_insert_own" ON "document_usages"
  FOR INSERT TO authenticated
  WITH CHECK ("owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid));

CREATE POLICY "document_usages_update_own" ON "document_usages"
  FOR UPDATE TO authenticated
  USING ("owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid))
  WITH CHECK ("owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid));

CREATE POLICY "document_usages_delete_own" ON "document_usages"
  FOR DELETE TO authenticated
  USING ("owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid));

DO $storage_policies$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE $select_policy$
      CREATE POLICY "document_storage_select_own" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)::text
        )
    $select_policy$;

    EXECUTE $insert_policy$
      CREATE POLICY "document_storage_insert_own" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)::text
        )
    $insert_policy$;

    EXECUTE $update_policy$
      CREATE POLICY "document_storage_update_own" ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)::text
        )
        WITH CHECK (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)::text
        )
    $update_policy$;

    EXECUTE $delete_policy$
      CREATE POLICY "document_storage_delete_own" ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)::text
        )
    $delete_policy$;
  END IF;
END
$storage_policies$;
