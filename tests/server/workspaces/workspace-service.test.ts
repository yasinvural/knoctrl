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
  getWorkspaceDetail,
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

  it("maps accurate root and folder counts and pages only the requested owned location", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue({
      id: "workspace-1", name: "Research", createdAt: new Date(), documents: [],
      folders: [{ id: "folder-1", name: "Folder", createdAt: new Date(), documents: [], _count: { documents: 51 } }],
      _count: { documents: 54 },
    });
    prismaMock.document.findMany.mockResolvedValue([{ id: "document-51", filename: "last.txt", folderId: "folder-1", status: "available", failureMessage: null, createdAt: new Date() }]);
    const result = await getWorkspaceDetail("owner-1", "workspace-1", { folderId: "folder-1", page: 999 });
    expect(result).toMatchObject({ documentCount: 54, rootDocumentCount: 3, documentPage: 1,
      folders: [{ documentCount: 51, documentPage: 2, documents: [{ id: "document-51" }] }] });
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-1", folderId: "folder-1", workspace: { ownerId: "owner-1" } }, take: 50, skip: 50,
    }));
  });

  it("does not query a document page for a folder outside the owned workspace", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue({
      id: "workspace-1", name: "Research", createdAt: new Date(), folders: [], documents: [], _count: { documents: 100 },
    });
    await getWorkspaceDetail("owner-1", "workspace-1", { folderId: "foreign-folder", page: 2 });
    expect(prismaMock.document.findMany).not.toHaveBeenCalled();
  });

  it("does not apply a cursor that belongs to another owner", async () => {
    prismaMock.workspace.findFirst.mockResolvedValue(null);
    prismaMock.workspace.findMany.mockResolvedValue([]);

    await expect(listWorkspaces("owner-1", "workspace-owned-by-someone-else")).resolves.toEqual({
      workspaces: [],
      nextCursor: null,
    });
    expect(prismaMock.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        id: "workspace-owned-by-someone-else",
        ownerId: "owner-1",
      },
      select: { id: true },
    });
    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ cursor: expect.anything(), skip: 1 })
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
