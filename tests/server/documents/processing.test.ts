import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(), $executeRaw: vi.fn(),
    document: { findFirst: vi.fn(), updateMany: vi.fn() },
    documentChunk: { deleteMany: vi.fn() },
  },
  download: vi.fn(), extract: vi.fn(), embed: vi.fn(),
}));
vi.mock("@/server/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/integrations/supabase/document-storage", () => ({
  createDocumentStorage: () => ({ download: mocks.download }),
}));
vi.mock("@/server/integrations/openai/embeddings", () => ({ embedTexts: mocks.embed }));
vi.mock("@/server/documents/extraction", () => ({
  extractDocumentText: mocks.extract,
  DocumentExtractionError: class extends Error {},
}));

import { DocumentExtractionError } from "@/server/documents/extraction";
import { failDocument, processDocument } from "@/server/documents/processing";

const request = { documentId: "00000000-0000-4000-8000-000000000001", processingAttempt: 2 };

describe("document processing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.document.findFirst.mockResolvedValue({ filename: "sample.txt", storageKey: "private/key", fileSize: BigInt(5) });
    mocks.prisma.document.updateMany.mockResolvedValue({ count: 1 });
    mocks.download.mockResolvedValue({ data: new Blob(["hello"]), error: null });
    mocks.extract.mockResolvedValue("hello");
    mocks.embed.mockResolvedValue([Array(1536).fill(0.1)]);
  });

  it("persists parameterized vectors and chunks inside the availability transaction", async () => {
    await expect(processDocument(request)).resolves.toBe("available");
    expect(mocks.prisma.$executeRaw).toHaveBeenCalledOnce();
    const sql = mocks.prisma.$executeRaw.mock.calls[0][0];
    expect(sql.sql).not.toContain("hello");
    expect(sql.values).toContain("hello");
    expect(mocks.prisma.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ processingAttempt: 2, status: "processing" }),
      data: expect.objectContaining({ status: "available" }),
    }));
  });

  it("ignores stale, deleted, or already available documents before provider work", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(null);
    await expect(processDocument(request)).resolves.toBe("skipped");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("does not write chunks if deletion or another attempt wins before persistence", async () => {
    mocks.prisma.document.updateMany.mockResolvedValue({ count: 0 });
    await expect(processDocument(request)).resolves.toBe("skipped");
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.prisma.documentChunk.deleteMany).not.toHaveBeenCalled();
  });

  it("marks unreadable or empty documents failed and removes obsolete chunks", async () => {
    mocks.extract.mockRejectedValue(new DocumentExtractionError("private parser error"));
    await expect(processDocument(request)).resolves.toBe("failed");
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.prisma.documentChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: request.documentId } });
  });

  it("throws a safe error for missing Storage objects so Inngest retries", async () => {
    mocks.download.mockResolvedValue({ error: new Error("private/key"), data: null });
    await expect(processDocument(request)).rejects.toThrow("Document processing temporarily unavailable.");
    expect(mocks.prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("throws a safe error on embedding failure without publishing chunks", async () => {
    mocks.embed.mockRejectedValue(new Error("secret provider error"));
    await expect(processDocument(request)).rejects.toThrow("Document processing temporarily unavailable.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("never lets an exhausted old attempt change a newer document", async () => {
    mocks.prisma.document.updateMany.mockResolvedValue({ count: 0 });
    await failDocument(request);
    expect(mocks.prisma.documentChunk.deleteMany).not.toHaveBeenCalled();
  });

  it("does not accept an object whose actual size differs from the reservation", async () => {
    mocks.download.mockResolvedValue({ data: new Blob(["different"]), error: null });
    await expect(processDocument(request)).resolves.toBe("failed");
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.prisma.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failureCode: "object_size_mismatch" }),
    }));
  });

  it("rejects a failed persistence transaction without leaking raw SQL details", async () => {
    mocks.prisma.$executeRaw.mockRejectedValue(new Error("private content and SQL"));
    await expect(processDocument(request)).rejects.toThrow("Document processing temporarily unavailable.");
  });
});
