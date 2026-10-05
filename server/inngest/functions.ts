import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { expireDocumentUpload } from "@/server/documents/document-service";
import { failDocument, processDocument } from "@/server/documents/processing";
import { cleanupStorageTask } from "@/server/documents/storage-cleanup";

import { inngest, processingRequestSchema } from "./events";

export const documentFunctions = [
  inngest.createFunction(
    {
      id: "process-document",
      triggers: { event: "documents/process.requested" },
      retries: 3,
      concurrency: { limit: 1, key: "event.data.documentId" },
      onFailure: async ({ event }) => {
        const parsed = processingRequestSchema.safeParse(event.data.event.data);
        if (parsed.success) await failDocument(parsed.data);
      },
    },
    async ({ event, step, logger }) => {
      const request = processingRequestSchema.parse(event.data);
      const outcome = await step.run("process-and-persist", () => processDocument(request));
      logger.info("document_processing", { outcome, processingAttempt: request.processingAttempt });
      return { outcome };
    }
  ),
  inngest.createFunction(
    { id: "expire-upload-reservations", triggers: { cron: "*/5 * * * *" }, concurrency: 1 },
    async ({ step }) => {
      const expired = await step.run("list-expired", () => prisma.document.findMany({
        // Wait beyond the two-hour signed-upload token lifetime before removal.
        where: { uploadedAt: null, uploadIntentExpiresAt: { lt: new Date(Date.now() - 65 * 60 * 1000) } },
        orderBy: { uploadIntentExpiresAt: "asc" }, take: 100,
        select: { id: true, workspace: { select: { ownerId: true } } },
      }));
      for (const document of expired) {
        await step.run(`expire-${document.id}`, () => expireDocumentUpload(document.workspace.ownerId, document.id));
      }
    }
  ),
  inngest.createFunction(
    {
      id: "cleanup-document-storage",
      triggers: { event: "documents/storage-cleanup.requested" },
      retries: 5,
    },
    async ({ event, step, logger }) => {
      const { taskId } = z.object({ taskId: z.string().uuid() }).parse(event.data);
      const outcome = await step.run("remove-object", () => cleanupStorageTask(taskId));
      logger.info("document_storage_cleanup", { outcome });
      return { outcome };
    }
  ),
  inngest.createFunction(
    { id: "sweep-document-storage-cleanup", triggers: { cron: "*/5 * * * *" }, concurrency: 1 },
    async ({ step }) => {
      const tasks = await step.run("list-pending", () => prisma.storageCleanupTask.findMany({
        where: { status: "pending" },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 100, select: { id: true },
      }));
      if (tasks.length) await step.sendEvent("dispatch-cleanup", tasks.map((task) => ({
        name: "documents/storage-cleanup.requested", data: { taskId: task.id },
      })));
    }
  ),
];
