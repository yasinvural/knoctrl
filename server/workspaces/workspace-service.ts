import "server-only";

import { prisma } from "@/server/db/prisma";
import {
  prepareDocumentDeletion,
} from "@/server/documents/document-service";
import type { DocumentListItem } from "@/server/documents/types";

import {
  validateWorkspaceResourceName,
  type ValidatedWorkspaceResourceName,
} from "./names";

const workspacePageSize = 50;

export type WorkspaceListItem = {
  id: string;
  name: string;
  createdAt: Date;
};

export type FolderListItem = {
  id: string;
  name: string;
  createdAt: Date;
  documents: DocumentListItem[];
};

export type WorkspaceDetail = WorkspaceListItem & {
  folders: FolderListItem[];
  documents: DocumentListItem[];
  documentCount: number;
};

export type WorkspaceList = {
  workspaces: WorkspaceListItem[];
  nextCursor: string | null;
};

export type WorkspaceMutationResult =
  | { status: "success" }
  | { status: "invalid"; fieldError: string }
  | { status: "duplicate"; fieldError: string }
  | { status: "unavailable" }
  | { status: "error" };

export type WorkspaceDeletionResult =
  | {
      status: "success";
      folderCount: number;
      documentCount: number;
    }
  | { status: "unavailable" }
  | { status: "error" };

export type FolderDeletionResult =
  | { status: "success"; documentCount: number }
  | { status: "unavailable" }
  | { status: "error" };

function isPrismaErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function validateNameForMutation(
  input: unknown
):
  | { status: "valid"; value: ValidatedWorkspaceResourceName }
  | { status: "invalid"; fieldError: string } {
  const result = validateWorkspaceResourceName(input);

  if (result.status === "invalid") {
    return { status: "invalid", fieldError: result.error };
  }

  return result;
}

export async function listWorkspaces(
  ownerId: string,
  cursor?: string
): Promise<WorkspaceList> {
  const ownedCursor = cursor
    ? await prisma.workspace.findFirst({
        where: { id: cursor, ownerId },
        select: { id: true },
      })
    : null;
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: workspacePageSize + 1,
    ...(ownedCursor ? { cursor: { id: ownedCursor.id }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
  const hasNextPage = workspaces.length > workspacePageSize;
  const pageWorkspaces = hasNextPage
    ? workspaces.slice(0, workspacePageSize)
    : workspaces;

  return {
    workspaces: pageWorkspaces,
    nextCursor: hasNextPage
      ? (pageWorkspaces[pageWorkspaces.length - 1]?.id ?? null)
      : null,
  };
}

export async function getWorkspaceDetail(
  ownerId: string,
  workspaceId: string
): Promise<WorkspaceDetail | null> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      ownerId,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      folders: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          createdAt: true,
          documents: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: workspacePageSize,
            select: {
              id: true,
              filename: true,
              folderId: true,
              status: true,
              failureMessage: true,
              createdAt: true,
            },
          },
        },
      },
      documents: {
        where: { folderId: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: workspacePageSize,
        select: {
          id: true,
          filename: true,
          folderId: true,
          status: true,
          failureMessage: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          documents: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    folders: workspace.folders,
    documents: workspace.documents,
    documentCount: workspace._count.documents,
  };
}

export async function createWorkspace(
  ownerId: string,
  input: unknown
): Promise<WorkspaceMutationResult> {
  const name = validateNameForMutation(input);

  if (name.status === "invalid") {
    return name;
  }

  try {
    await prisma.workspace.create({
      data: {
        ownerId,
        name: name.value.name,
        normalizedName: name.value.normalizedName,
      },
    });

    return { status: "success" };
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      return {
        status: "duplicate",
        fieldError: "You already have a workspace with that name.",
      };
    }

    return { status: "error" };
  }
}

export async function renameWorkspace(
  ownerId: string,
  workspaceId: string,
  input: unknown
): Promise<WorkspaceMutationResult> {
  const name = validateNameForMutation(input);

  if (name.status === "invalid") {
    return name;
  }

  try {
    const updated = await prisma.workspace.updateMany({
      where: {
        id: workspaceId,
        ownerId,
      },
      data: {
        name: name.value.name,
        normalizedName: name.value.normalizedName,
      },
    });

    return updated.count === 1 ? { status: "success" } : { status: "unavailable" };
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      return {
        status: "duplicate",
        fieldError: "You already have a workspace with that name.",
      };
    }

    return { status: "error" };
  }
}

export async function deleteWorkspace(
  ownerId: string,
  workspaceId: string
): Promise<WorkspaceDeletionResult> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.findFirst({
        where: {
          id: workspaceId,
          ownerId,
        },
        select: {
          id: true,
          _count: {
            select: {
              folders: true,
              documents: true,
            },
          },
        },
      });

      if (!workspace) {
        return { status: "unavailable" };
      }

      const documents = await transaction.document.findMany({
        where: { workspaceId: workspace.id },
        select: { storageKey: true, fileSize: true, uploadedAt: true },
      });

      await prepareDocumentDeletion(transaction, ownerId, documents);

      const deleted = await transaction.workspace.deleteMany({
        where: {
          id: workspace.id,
          ownerId,
        },
      });

      if (deleted.count !== 1) {
        return { status: "unavailable" };
      }

      return {
        status: "success",
        folderCount: workspace._count.folders,
        documentCount: workspace._count.documents,
      };
    });
  } catch {
    return { status: "error" };
  }
}

export async function createFolder(
  ownerId: string,
  workspaceId: string,
  input: unknown
): Promise<WorkspaceMutationResult> {
  const name = validateNameForMutation(input);

  if (name.status === "invalid") {
    return name;
  }

  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    if (!workspace) {
      return { status: "unavailable" };
    }

    await prisma.folder.create({
      data: {
        workspaceId: workspace.id,
        name: name.value.name,
        normalizedName: name.value.normalizedName,
      },
    });

    return { status: "success" };
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      return {
        status: "duplicate",
        fieldError: "This workspace already has a folder with that name.",
      };
    }

    if (isPrismaErrorWithCode(error, "P2003")) {
      return { status: "unavailable" };
    }

    return { status: "error" };
  }
}

export async function renameFolder(
  ownerId: string,
  folderId: string,
  input: unknown
): Promise<WorkspaceMutationResult> {
  const name = validateNameForMutation(input);

  if (name.status === "invalid") {
    return name;
  }

  try {
    const updated = await prisma.folder.updateMany({
      where: {
        id: folderId,
        workspace: {
          ownerId,
        },
      },
      data: {
        name: name.value.name,
        normalizedName: name.value.normalizedName,
      },
    });

    return updated.count === 1 ? { status: "success" } : { status: "unavailable" };
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      return {
        status: "duplicate",
        fieldError: "This workspace already has a folder with that name.",
      };
    }

    return { status: "error" };
  }
}

export async function deleteFolder(
  ownerId: string,
  folderId: string
): Promise<FolderDeletionResult> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const folder = await transaction.folder.findFirst({
        where: {
          id: folderId,
          workspace: {
            ownerId,
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

      if (!folder) {
        return { status: "unavailable" };
      }

      const documents = await transaction.document.findMany({
        where: { folderId: folder.id, workspace: { ownerId } },
        select: { storageKey: true, fileSize: true, uploadedAt: true },
      });

      await prepareDocumentDeletion(transaction, ownerId, documents);

      const deleted = await transaction.folder.deleteMany({
        where: {
          id: folder.id,
          workspace: {
            ownerId,
          },
        },
      });

      return deleted.count === 1
        ? { status: "success", documentCount: folder._count.documents }
        : { status: "unavailable" };
    });
  } catch {
    return { status: "error" };
  }
}
