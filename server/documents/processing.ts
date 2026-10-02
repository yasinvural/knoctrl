import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/server/db/generated/client";
import { prisma } from "@/server/db/prisma";
import { embedTexts } from "@/server/integrations/openai/embeddings";
import { createDocumentStorage } from "@/server/integrations/supabase/document-storage";

import { createTextChunks } from "./chunking";
import { DocumentExtractionError, extractDocumentText } from "./extraction";

export type ProcessingRequest = { documentId: string; processingAttempt: number };

async function markDocumentFailed(request: ProcessingRequest, code: string) {
  await prisma.$transaction(async (transaction) => {
    const changed = await transaction.document.updateMany({
      where: { id: request.documentId, processingAttempt: request.processingAttempt, status: "processing" },
      data: { status: "failed", failureCode: code, failureMessage: "We couldn't process this file. Try again.", availableAt: null },
    });
    if (changed.count === 1) {
      await transaction.documentChunk.deleteMany({ where: { documentId: request.documentId } });
    }
  });
}

export async function failDocument(request: ProcessingRequest, code = "processing_failed") {
  try {
    await markDocumentFailed(request, code);
  } catch {
    throw new Error("Document failure status could not be saved.");
  }
}

async function processCurrentDocument(request: ProcessingRequest): Promise<"available" | "failed" | "skipped"> {
  const document = await prisma.document.findFirst({
    where: { id: request.documentId, processingAttempt: request.processingAttempt, status: "processing", uploadedAt: { not: null } },
    select: { filename: true, storageKey: true, fileSize: true },
  });
  if (!document) return "skipped";
  const stored = await createDocumentStorage().download(document.storageKey);
  if (stored.error || !stored.data) throw new Error("Document object could not be retrieved.");
  if (BigInt(stored.data.size) !== document.fileSize) {
    await failDocument(request, "object_size_mismatch");
    return "failed";
  }
  let text: string;
  try {
    text = await extractDocumentText(Buffer.from(await stored.data.arrayBuffer()), document.filename);
  } catch (error) {
    if (!(error instanceof DocumentExtractionError)) throw new Error("Document extraction unavailable.");
    await failDocument(request, "extraction_failed");
    return "failed";
  }
  const chunks = createTextChunks(text);
  const vectors = await embedTexts(chunks.map((chunk) => chunk.content)).catch(() => {
    throw new Error("Document embedding unavailable.");
  });
  return prisma.$transaction(async (transaction) => {
    // This conditional UPDATE locks the row until chunks and availability commit.
    const current = await transaction.document.updateMany({
      where: { id: request.documentId, processingAttempt: request.processingAttempt, status: "processing", uploadedAt: { not: null } },
      data: { status: "available", availableAt: new Date(), failureCode: null, failureMessage: null },
    });
    if (current.count !== 1) return "skipped";
    await transaction.documentChunk.deleteMany({ where: { documentId: request.documentId } });
    for (let offset = 0; offset < chunks.length; offset += 32) {
      const rows = chunks.slice(offset, offset + 32).map((chunk, index) => {
        const vector = vectors[offset + index];
        if (!vector) throw new Error("Embedding response incomplete.");
        return Prisma.sql`(${randomUUID()}::uuid, ${request.documentId}::uuid, ${request.processingAttempt}, ${chunk.sequence}, ${chunk.content}, ${chunk.startOffset}, ${chunk.endOffset}, CURRENT_TIMESTAMP, ${JSON.stringify(vector)}::vector)`;
      });
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "document_chunks" ("id", "document_id", "processing_attempt", "sequence", "content", "start_offset", "end_offset", "created_at", "embedding")
        VALUES ${Prisma.join(rows)}
      `);
    }
    return "available";
  }, { timeout: 30000 });
}

export async function processDocument(request: ProcessingRequest): Promise<"available" | "failed" | "skipped"> {
  try {
    return await processCurrentDocument(request);
  } catch {
    // Inngest records thrown errors; never forward provider or SQL details.
    throw new Error("Document processing temporarily unavailable.");
  }
}
