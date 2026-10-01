import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/server/db/generated/client";
import { serverEnvironment } from "@/server/config/env";
import { prisma } from "@/server/db/prisma";

import type {
  DocumentDeletionResult,
  DocumentCompletionCandidateResult,
  DocumentCompletionResult,
  DocumentListItem,
  DocumentReservation,
  DocumentReservationResult,
  DocumentRetryResult,
  DocumentUploadMetadata,
} from "./types";
import { validateDocumentUploadBatch } from "./validation";

type DocumentTransaction = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

type LockedDocumentUsage = {
  storedBytes: bigint;
  reservedBytes: bigint;
};

const uploadIntentLifetimeMilliseconds = 60 * 60 * 1000;

export async function queueDocumentStorageCleanup(
  transaction: DocumentTransaction,
  ownerId: string,
  documents: readonly { storageKey: string }[]
): Promise<void> {
  if (documents.length === 0) {
    return;
  }

  await transaction.storageCleanupTask.createMany({
    data: documents.map((document) => ({
      ownerId,
      storageKey: document.storageKey,
    })),
    skipDuplicates: true,
  });
}

export async function prepareDocumentDeletion(
  transaction: DocumentTransaction,
  ownerId: string,
  documents: readonly {
    storageKey: string;
    fileSize: bigint;
    uploadedAt: Date | null;
  }[]
): Promise<void> {
  if (documents.length === 0) {
    return;
  }

  await queueDocumentStorageCleanup(transaction, ownerId, documents);

  const usage = await getLockedUsage(transaction, ownerId);
  const storedBytesToRelease = documents.reduce(
    (total, document) =>
      document.uploadedAt ? total + document.fileSize : total,
    BigInt(0)
  );
  const reservedBytesToRelease = documents.reduce(
    (total, document) =>
      document.uploadedAt ? total : total + document.fileSize,
    BigInt(0)
  );

  await transaction.documentUsage.update({
    where: { ownerId },
    data: {
      storedBytes:
        usage.storedBytes > storedBytesToRelease
          ? usage.storedBytes - storedBytesToRelease
          : BigInt(0),
      reservedBytes:
        usage.reservedBytes > reservedBytesToRelease
          ? usage.reservedBytes - reservedBytesToRelease
          : BigInt(0),
    },
  });
}

function isPrismaErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function toReservation(document: {
  id: string;
  filename: string;
  contentType: string;
  fileSize: bigint;
  storageKey: string;
  processingAttempt: number;
}): DocumentReservation {
  return {
    id: document.id,
    filename: document.filename,
    contentType: document.contentType,
    fileSize: Number(document.fileSize),
    storageKey: document.storageKey,
    processingAttempt: document.processingAttempt,
  };
}

async function getLockedUsage(
  transaction: DocumentTransaction,
  ownerId: string
): Promise<LockedDocumentUsage> {
  await transaction.documentUsage.upsert({
    where: { ownerId },
    create: { ownerId },
    update: {},
  });

  const usage = await transaction.$queryRaw<LockedDocumentUsage[]>(Prisma.sql`
    SELECT
      "stored_bytes" AS "storedBytes",
      "reserved_bytes" AS "reservedBytes"
    FROM "document_usages"
    WHERE "owner_id" = ${ownerId}::uuid
    FOR UPDATE
  `);

  const lockedUsage = usage[0];

  if (!lockedUsage) {
    throw new Error("Document usage row was unavailable after upsert.");
  }

  return lockedUsage;
}

export async function reserveDocuments(
  ownerId: string,
  input: {
    workspaceId: string;
    folderId?: string;
    files: readonly DocumentUploadMetadata[];
  },
  quotaBytes = serverEnvironment.DOCUMENT_STORAGE_QUOTA_BYTES
): Promise<DocumentReservationResult> {
  const validation = validateDocumentUploadBatch(input.files);

  if (validation.status === "rejected") {
    return {
      status: "invalid",
      formError: validation.formError,
      rejectedFiles: validation.rejectedFiles,
    };
  }

  if (validation.acceptedFiles.length === 0) {
    return {
      status: "invalid",
      formError: "Select at least one supported file to upload.",
      rejectedFiles: validation.rejectedFiles,
    };
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const uploadIntentExpiresAt = new Date(
        Date.now() + uploadIntentLifetimeMilliseconds
      );
      const workspace = await transaction.workspace.findFirst({
        where: { id: input.workspaceId, ownerId },
        select: { id: true },
      });

      if (!workspace) {
        return {
          status: "unavailable",
          formError: "This workspace is no longer available.",
        };
      }

      if (input.folderId) {
        const folder = await transaction.folder.findFirst({
          where: { id: input.folderId, workspaceId: workspace.id },
          select: { id: true },
        });

        if (!folder) {
          return {
            status: "unavailable",
            formError: "This folder is no longer available in the selected workspace.",
          };
        }
      }

      const existingDocuments = await transaction.document.findMany({
        where: {
          workspaceId: workspace.id,
          folderId: input.folderId ?? null,
          filename: { in: validation.acceptedFiles.map((file) => file.filename) },
        },
        select: { filename: true },
      });

      if (existingDocuments.length > 0) {
        const existingNames = new Set(
          existingDocuments.map((document) => document.filename)
        );

        return {
          status: "duplicate",
          formError: "A file with this name already exists in the selected location.",
          rejectedFiles: validation.acceptedFiles
            .filter((file) => existingNames.has(file.filename))
            .map((file) => ({
              filename: file.filename,
              code: "duplicate_filename" as const,
              fieldError:
                "A file with this name already exists in the selected location.",
            })),
        };
      }

      const bytesToReserve = validation.acceptedFiles.reduce(
        (total, file) => total + BigInt(file.fileSize),
        BigInt(0)
      );
      const usage = await getLockedUsage(transaction, ownerId);

      if (usage.storedBytes + usage.reservedBytes + bytesToReserve > BigInt(quotaBytes)) {
        return {
          status: "quota",
          formError: "These files exceed your remaining 100 MB storage quota.",
          rejectedFiles: validation.rejectedFiles,
        };
      }

      await transaction.documentUsage.update({
        where: { ownerId },
        data: { reservedBytes: usage.reservedBytes + bytesToReserve },
      });

      const documents: DocumentReservation[] = [];

      for (const file of validation.acceptedFiles) {
        const document = await transaction.document.create({
          data: {
            workspaceId: workspace.id,
            folderId: input.folderId,
            filename: file.filename,
            storageKey: `${ownerId}/${randomUUID()}`,
            contentType: file.contentType,
            fileSize: BigInt(file.fileSize),
            uploadIntentExpiresAt,
          },
          select: {
            id: true,
            filename: true,
            contentType: true,
            fileSize: true,
            storageKey: true,
            processingAttempt: true,
          },
        });

        documents.push(toReservation(document));
      }

      return {
        status: "success",
        documents,
        rejectedFiles: validation.rejectedFiles,
      };
    });
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      return {
        status: "duplicate",
        formError: "A file with this name already exists in the selected location.",
        rejectedFiles: validation.rejectedFiles,
      };
    }

    return {
      status: "error",
      formError: "We couldn't prepare these files for upload. Please try again.",
    };
  }
}

export async function listDocumentsForWorkspace(
  ownerId: string,
  workspaceId: string
): Promise<DocumentListItem[] | null> {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
    select: {
      documents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
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
  });

  return workspace?.documents ?? null;
}

export async function retryDocument(
  ownerId: string,
  documentId: string
): Promise<DocumentRetryResult> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const document = await transaction.document.findFirst({
        where: { id: documentId, workspace: { ownerId } },
        select: { status: true, processingAttempt: true },
      });

      if (!document) {
        return { status: "unavailable" };
      }

      if (document.status !== "failed") {
        return { status: "invalid_state" };
      }

      const updated = await transaction.document.updateMany({
        where: { id: documentId, status: "failed", workspace: { ownerId } },
        data: {
          status: "processing",
          processingAttempt: { increment: 1 },
          failureCode: null,
          failureMessage: null,
          availableAt: null,
        },
      });

      if (updated.count !== 1) {
        return { status: "conflict" };
      }

      return {
        status: "success",
        processingAttempt: document.processingAttempt + 1,
      };
    });
  } catch {
    return { status: "error" };
  }
}

export async function deleteDocument(
  ownerId: string,
  documentId: string
): Promise<DocumentDeletionResult> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const document = await transaction.document.findFirst({
        where: { id: documentId, workspace: { ownerId } },
        select: { id: true, storageKey: true, fileSize: true, uploadedAt: true },
      });

      if (!document) {
        return { status: "unavailable" };
      }

      await prepareDocumentDeletion(transaction, ownerId, [document]);

      const deleted = await transaction.document.deleteMany({
        where: { id: document.id, workspace: { ownerId } },
      });

      return deleted.count === 1 ? { status: "success" } : { status: "unavailable" };
    });
  } catch {
    return { status: "error" };
  }
}

export async function getDocumentCompletionCandidate(
  ownerId: string,
  documentId: string
): Promise<DocumentCompletionCandidateResult> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspace: { ownerId } },
    select: {
      id: true,
      storageKey: true,
      contentType: true,
      fileSize: true,
      processingAttempt: true,
      uploadIntentExpiresAt: true,
      status: true,
      uploadedAt: true,
    },
  });

  if (!document) {
    return { status: "unavailable" };
  }

  if (document.status !== "processing") {
    return { status: "invalid_state" };
  }

  if (!document.uploadedAt && document.uploadIntentExpiresAt <= new Date()) {
    return { status: "invalid_state" };
  }

  return {
    status: "success",
    document: {
      id: document.id,
      storageKey: document.storageKey,
      contentType: document.contentType,
      fileSize: Number(document.fileSize),
      processingAttempt: document.processingAttempt,
      uploadedAt: document.uploadedAt,
    },
  };
}

export async function completeDocumentUpload(
  ownerId: string,
  documentId: string
): Promise<DocumentCompletionResult> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const document = await transaction.document.findFirst({
        where: { id: documentId, workspace: { ownerId } },
        select: {
          fileSize: true,
          processingAttempt: true,
          status: true,
          uploadedAt: true,
        },
      });

      if (!document) {
        return { status: "unavailable" };
      }

      if (document.status !== "processing") {
        return { status: "invalid_state" };
      }

      if (document.uploadedAt) {
        return {
          status: "already_completed",
          processingAttempt: document.processingAttempt,
        };
      }

      const markedUploaded = await transaction.document.updateMany({
        where: {
          id: documentId,
          status: "processing",
          uploadedAt: null,
          workspace: { ownerId },
        },
        data: { uploadedAt: new Date() },
      });

      if (markedUploaded.count !== 1) {
        return { status: "conflict" };
      }

      const usage = await getLockedUsage(transaction, ownerId);
      const reservedBytes =
        usage.reservedBytes > document.fileSize
          ? usage.reservedBytes - document.fileSize
          : BigInt(0);

      await transaction.documentUsage.update({
        where: { ownerId },
        data: {
          storedBytes: usage.storedBytes + document.fileSize,
          reservedBytes,
        },
      });

      return {
        status: "success",
        processingAttempt: document.processingAttempt,
      };
    });
  } catch {
    return { status: "error" };
  }
}
