-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspaces_owner_id_created_at_id_idx" ON "workspaces"("owner_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_owner_id_normalized_name_key" ON "workspaces"("owner_id", "normalized_name");

-- CreateIndex
CREATE INDEX "folders_workspace_id_created_at_id_idx" ON "folders"("workspace_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_workspace_id_normalized_name_key" ON "folders"("workspace_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security for direct Supabase data access. Application code
-- also scopes every Prisma query by the server-verified owner identity.
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_select_own" ON "workspaces"
  FOR SELECT TO authenticated
  USING ((SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid) = "owner_id");

CREATE POLICY "workspaces_insert_own" ON "workspaces"
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid) = "owner_id");

CREATE POLICY "workspaces_update_own" ON "workspaces"
  FOR UPDATE TO authenticated
  USING ((SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid) = "owner_id")
  WITH CHECK ((SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid) = "owner_id");

CREATE POLICY "workspaces_delete_own" ON "workspaces"
  FOR DELETE TO authenticated
  USING ((SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid) = "owner_id");

CREATE POLICY "folders_select_workspace_owner" ON "folders"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "workspaces"
      WHERE "workspaces"."id" = "folders"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "folders_insert_workspace_owner" ON "folders"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "workspaces"
      WHERE "workspaces"."id" = "folders"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "folders_update_workspace_owner" ON "folders"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "workspaces"
      WHERE "workspaces"."id" = "folders"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "workspaces"
      WHERE "workspaces"."id" = "folders"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

CREATE POLICY "folders_delete_workspace_owner" ON "folders"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "workspaces"
      WHERE "workspaces"."id" = "folders"."workspace_id"
        AND "workspaces"."owner_id" = (SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );
