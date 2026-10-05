"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { DocumentFormState } from "@/lib/document-form-state";
import { getCurrentUser } from "@/server/auth/current-user";
import { createInngestClient } from "@/server/integrations/inngest/client";

import { cancelDocumentUpload, deleteDocument, retryDocument } from "./document-service";
import { failDocument } from "./processing";

const documentIdSchema = z.string().uuid();

async function requireOwnerId(): Promise<string> {
  const currentUser = await getCurrentUser();
  if (currentUser.status === "unauthenticated") redirect("/sign-in");
  return currentUser.user.id;
}

function refreshDocuments() {
  revalidatePath("/app/workspaces/[workspaceId]", "page");
  revalidatePath("/app");
}

export async function retryDocumentAction(
  _previousState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const ownerId = await requireOwnerId();
  const parsed = documentIdSchema.safeParse(formData.get("documentId"));
  if (!parsed.success) return { status: "error", formError: "This document is no longer available." };
  const result = await retryDocument(ownerId, parsed.data);
  if (result.status !== "success") {
    return { status: "error", formError: result.status === "error"
      ? "We couldn't retry this file. Please try again."
      : "This document can no longer be retried. Refresh and try again." };
  }
  try {
    await createInngestClient().send({
      id: `${parsed.data}:${result.processingAttempt}`,
      name: "documents/process.requested",
      data: { documentId: parsed.data, processingAttempt: result.processingAttempt },
    });
  } catch {
    try {
      await failDocument({ documentId: parsed.data, processingAttempt: result.processingAttempt }, "dispatch_failed");
    } catch {
      refreshDocuments();
      return { status: "error", formError: "Processing could not be started. Refresh to check this document." };
    }
    refreshDocuments();
    return { status: "error", formError: "We couldn't start processing. Please retry this file." };
  }
  refreshDocuments();
  return { status: "success" };
}

export async function deleteDocumentAction(
  _previousState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const ownerId = await requireOwnerId();
  const parsed = documentIdSchema.safeParse(formData.get("documentId"));
  if (!parsed.success || formData.get("confirmation") !== "delete") {
    return { status: "error", formError: "Confirm deletion before permanently removing this document." };
  }
  const result = await deleteDocument(ownerId, parsed.data);
  if (result.status !== "success") {
    return { status: "error", formError: result.status === "unavailable"
      ? "This document is no longer available. Refresh and try again."
      : "We couldn't delete this document. Please try again." };
  }
  refreshDocuments();
  return { status: "success" };
}

export async function cancelDocumentUploadAction(documentId: string): Promise<DocumentFormState> {
  const ownerId = await requireOwnerId();
  const parsed = documentIdSchema.safeParse(documentId);
  if (!parsed.success) return { status: "error", formError: "This upload is no longer available." };
  const result = await cancelDocumentUpload(ownerId, parsed.data);
  refreshDocuments();
  return result.status === "success" ? { status: "success" }
    : { status: "error", formError: "The incomplete upload could not be removed. Refresh and try again." };
}
