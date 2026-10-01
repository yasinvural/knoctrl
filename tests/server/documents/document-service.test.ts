import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  document: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  documentUsage: {
    update: vi.fn(),
    upsert: vi.fn(),
  },
  folder: {
    findFirst: vi.fn(),
  },
  storageCleanupTask: {
    createMany: vi.fn(),
  },
  workspace: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: prismaMock,
}));

import {
  completeDocumentUpload,
  deleteDocument,
  reserveDocuments,
  retryDocument,
} from "@/server/documents/document-service";

const file = {
  filename: "notes.txt",
  contentType: "text/plain",
  fileSize: 10,
};

describe("document service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it("rejects a folder that is not in the owned upload workspace", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    prismaMock.folder.findFirst.mockResolvedValue(null);

    await expect(
      reserveDocuments("owner-1", {
        workspaceId: "workspace-1",
        folderId: "folder-2",
        files: [file],
      })
    ).resolves.toEqual({
      status: "unavailable",
      formError: "This folder is no longer available in the selected workspace.",
    });
    expect(prismaMock.folder.findFirst).toHaveBeenCalledWith({
      where: { id: "folder-2", workspaceId: "workspace-1" },
      select: { id: true },
    });
  });

  it("reserves quota only when the locked aggregate has capacity", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([
      { storedBytes: BigInt(95), reservedBytes: BigInt(0) },
    ]);

    await expect(
      reserveDocuments(
        "owner-1",
        { workspaceId: "workspace-1", files: [file] },
        100
      )
    ).resolves.toMatchObject({ status: "quota" });
    expect(prismaMock.documentUsage.update).not.toHaveBeenCalled();
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it("reserves the accepted files and generates owner-prefixed object keys", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([
      { storedBytes: BigInt(0), reservedBytes: BigInt(0) },
    ]);
    prismaMock.document.create.mockResolvedValue({
      id: "document-1",
      filename: file.filename,
      contentType: file.contentType,
      fileSize: BigInt(file.fileSize),
      storageKey: "owner-1/generated-key",
      processingAttempt: 1,
    });

    await expect(
      reserveDocuments("owner-1", { workspaceId: "workspace-1", files: [file] })
    ).resolves.toMatchObject({
      status: "success",
      documents: [
        {
          id: "document-1",
          storageKey: "owner-1/generated-key",
        },
      ],
    });
    expect(prismaMock.documentUsage.update).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      data: { reservedBytes: BigInt(10) },
    });
    expect(prismaMock.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          storageKey: expect.stringMatching(/^owner-1\//),
        }),
      })
    );
  });

  it("retries only a failed document still owned by the requester", async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      status: "failed",
      processingAttempt: 2,
    });
    prismaMock.document.updateMany.mockResolvedValue({ count: 1 });

    await expect(retryDocument("owner-1", "document-1")).resolves.toEqual({
      status: "success",
      processingAttempt: 3,
    });
    expect(prismaMock.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: "document-1",
        status: "failed",
        workspace: { ownerId: "owner-1" },
      },
      data: expect.objectContaining({
        status: "processing",
        processingAttempt: { increment: 1 },
      }),
    });
  });

  it("queues object cleanup before deleting an owned document", async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: "document-1",
      storageKey: "owner-1/generated-key",
      fileSize: BigInt(10),
      uploadedAt: null,
    });
    prismaMock.$queryRaw.mockResolvedValue([
      { storedBytes: BigInt(0), reservedBytes: BigInt(10) },
    ]);
    prismaMock.document.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteDocument("owner-1", "document-1")).resolves.toEqual({
      status: "success",
    });
    expect(prismaMock.storageCleanupTask.createMany).toHaveBeenCalledWith({
      data: [
        { ownerId: "owner-1", storageKey: "owner-1/generated-key" },
      ],
      skipDuplicates: true,
    });
    expect(prismaMock.documentUsage.update).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      data: { storedBytes: BigInt(0), reservedBytes: BigInt(0) },
    });
  });

  it("moves an owned reserved upload into stored usage exactly once", async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      fileSize: BigInt(10),
      processingAttempt: 1,
      status: "processing",
      uploadedAt: null,
    });
    prismaMock.document.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$queryRaw.mockResolvedValue([
      { storedBytes: BigInt(20), reservedBytes: BigInt(10) },
    ]);

    await expect(completeDocumentUpload("owner-1", "document-1")).resolves.toEqual({
      status: "success",
      processingAttempt: 1,
    });
    expect(prismaMock.documentUsage.update).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      data: { storedBytes: BigInt(30), reservedBytes: BigInt(0) },
    });
  });
});
