import "server-only";

import { z } from "zod";

import { createInngestClient } from "@/server/integrations/inngest/client";

export const inngest = createInngestClient();

export const processingRequestSchema = z.object({
  documentId: z.string().uuid(),
  processingAttempt: z.number().int().positive(),
});

export type DocumentProcessingEvent = {
  name: "documents/process.requested";
  data: {
    documentId: string;
    processingAttempt: number;
  };
};

export type StorageCleanupEvent = {
  name: "documents/storage-cleanup.requested";
  data: { taskId: string };
};
