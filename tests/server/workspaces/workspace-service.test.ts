import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  folder: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  workspace: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
}));
const prepareDocumentDeletion = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/prisma", () => ({
  prisma: prismaMock,
}));
vi.mock("@/server/documents/document-service", () => ({
  prepareDocumentDeletion,
}));

import {
  createFolder,
  createWorkspace,
  deleteFolder,
  listWorkspaces,
  renameFolder,
} from "@/server/workspaces/workspace-service";

describe("workspace service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock)
    );
    prismaMock.document.findMany.mockResolvedValue([]);
  });

  it("lists workspaces with an owner predicate and a bounded page", async () => {
    prismaMock.workspace.findMany.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Research",
        createdAt: new Date("2026-09-28T00:00:00.000Z"),
      },
    ]);

    await expect(listWorkspaces("owner-1")).resolves.toEqual({
      workspaces: [
        {
          id: "workspace-1",
          name: "Research",
          createdAt: new Date("2026-09-28T00:00:00.000Z"),
        },
      ],
      nextCursor: null,
    });
    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        where: { ownerId: "owner-1" },
      })
    );
  });

  it("does not persist an invalid workspace name", async () => {
    await expect(createWorkspace("owner-1", "   ")).resolves.toEqual({
      status: "invalid",
      fieldError: "Enter a name.",
    });
    expect(prismaMock.workspace.create).not.toHaveBeenCalled();
  });

  it("maps a workspace name constraint conflict to a safe field error", async () => {
    prismaMock.workspace.create.mockRejectedValue({ code: "P2002" });

    await expect(createWorkspace("owner-1", "Research")).resolves.toEqual({
      status: "duplicate",
      fieldError: "You already have a workspace with that name.",
    });
  });

  it("creates a folder only after resolving an owned workspace", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    prismaMock.folder.create.mockResolvedValue({ id: "folder-1" });

    await expect(
      createFolder("owner-1", "workspace-1", "Planning")
    ).resolves.toEqual({ status: "success" });
    expect(prismaMock.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        id: "workspace-1",
        ownerId: "owner-1",
      },
      select: {
        id: true,
      },
    });
    expect(prismaMock.folder.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        name: "Planning",
        normalizedName: "planning",
      },
    });
  });

  it("scopes folder rename through its workspace owner", async () => {
    prismaMock.folder.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      renameFolder("owner-1", "folder-1", "Archived")
    ).resolves.toEqual({ status: "unavailable" });
    expect(prismaMock.folder.updateMany).toHaveBeenCalledWith({
      where: {
        id: "folder-1",
        workspace: {
          ownerId: "owner-1",
        },
      },
      data: {
        name: "Archived",
        normalizedName: "archived",
      },
    });
  });

  it("reports the folder's document count before cascading deletion", async () => {
    prismaMock.folder.findFirst.mockResolvedValue({
      id: "folder-1",
      _count: { documents: 2 },
    });
    prismaMock.folder.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.document.findMany.mockResolvedValue([
      {
        storageKey: "owner-1/document-key",
        fileSize: BigInt(10),
        uploadedAt: null,
      },
    ]);

    await expect(deleteFolder("owner-1", "folder-1")).resolves.toEqual({
      status: "success",
      documentCount: 2,
    });
    expect(prismaMock.folder.findFirst).toHaveBeenCalledWith({
      where: {
        id: "folder-1",
        workspace: {
          ownerId: "owner-1",
        },
      },
      select: {
        id: true,
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });
    expect(prepareDocumentDeletion).toHaveBeenCalledWith(
      prismaMock,
      "owner-1",
      [
        {
          storageKey: "owner-1/document-key",
          fileSize: BigInt(10),
          uploadedAt: null,
        },
      ]
    );
  });
});
