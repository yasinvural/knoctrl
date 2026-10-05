import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { expect, it, vi } from "vitest";

import { PrismaClient, type Prisma } from "@/server/db/generated/client";

const boundary = vi.hoisted(() => ({ transaction: undefined as Prisma.TransactionClient | undefined }));

function currentTransaction() {
  if (!boundary.transaction) throw new Error("Smoke test transaction is not active.");
  return boundary.transaction;
}

vi.mock("@/server/db/prisma", () => ({ prisma: {
  document: { findFirst: (...args: Parameters<Prisma.TransactionClient["document"]["findFirst"]>) => currentTransaction().document.findFirst(...args) },
  $transaction: async (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) => callback(currentTransaction()),
} }));
vi.mock("@/server/integrations/supabase/document-storage", () => ({
  createDocumentStorage: () => ({ download: async () => ({ data: new Blob(["Synthetic smoke fixture"]), error: null }) }),
}));
vi.mock("@/server/integrations/openai/embeddings", () => ({
  embedTexts: async (texts: string[]) => texts.map(() => Array(1536).fill(0.1)),
}));

import { processDocument } from "@/server/documents/processing";

const databaseUrl = process.env.PROCESSING_SMOKE_DATABASE_URL;

it.skipIf(!databaseUrl)("persists a supported fixture and pgvector in an isolated rollback transaction", async () => {
  if (!databaseUrl) throw new Error("An isolated database URL is required.");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const rollback = new Error("Intentional smoke-test rollback");
  try {
    await expect(client.$transaction(async (transaction) => {
      boundary.transaction = transaction;
      const workspace = await transaction.workspace.create({ data: {
        ownerId: randomUUID(), name: "Synthetic smoke workspace", normalizedName: "synthetic smoke workspace",
      } });
      const document = await transaction.document.create({ data: {
        workspaceId: workspace.id, filename: "smoke.txt", storageKey: `smoke/${randomUUID()}`,
        contentType: "text/plain", fileSize: BigInt(Buffer.byteLength("Synthetic smoke fixture")),
        uploadIntentExpiresAt: new Date(Date.now() + 3600000), uploadedAt: new Date(),
      } });
      const request = { documentId: document.id, processingAttempt: 1 };
      await expect(processDocument(request)).resolves.toBe("available");
      await expect(processDocument(request)).resolves.toBe("skipped");
      const saved = await transaction.document.findUniqueOrThrow({ where: { id: document.id }, include: { chunks: true } });
      expect(saved.status).toBe("available");
      expect(saved.chunks).toHaveLength(1);
      expect(saved.chunks[0].content).toBe("Synthetic smoke fixture");
      const vectors = await transaction.$queryRaw<{ dimensions: number }[]>`
        SELECT vector_dims(embedding) AS dimensions FROM document_chunks WHERE document_id = ${document.id}::uuid
      `;
      expect(vectors).toEqual([{ dimensions: 1536 }]);
      throw rollback;
    }, { timeout: 30000 })).rejects.toBe(rollback);
  } finally {
    boundary.transaction = undefined;
    await client.$disconnect();
  }
}, 40000);
