import { z } from "zod";

import type { ValidatedDocumentUpload } from "@/server/documents/types";

const errorResponseSchema = z.object({ formError: z.string() });
export class DocumentUploadError extends Error {}
const uploadResponseSchema = z.object({
  status: z.literal("success"),
  uploads: z.array(z.object({ documentId: z.string().uuid(), filename: z.string(), signedUrl: z.string().url() })),
  rejectedFiles: z.array(z.object({ filename: z.string().nullable(), fieldError: z.string() })),
});

export async function requestDocumentUploads(
  workspaceId: string,
  folderId: string | undefined,
  files: ValidatedDocumentUpload[]
) {
  const response = await fetch("/api/documents/upload-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, folderId, files }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = errorResponseSchema.safeParse(body);
    throw new DocumentUploadError(error.success ? error.data.formError : "We couldn't prepare these files for upload.");
  }
  const parsed = uploadResponseSchema.safeParse(body);
  if (!parsed.success) throw new DocumentUploadError("We couldn't prepare these files for upload.");
  return parsed.data;
}

export function uploadDocumentFile(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress: (percentage: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.timeout = 120000;
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    const fail = () => reject(new Error("The file could not be uploaded. Please select it again."));
    request.onerror = fail;
    request.ontimeout = fail;
    request.onabort = fail;
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else fail();
    };
    // Match Supabase's signed-upload multipart protocol; the browser sets the boundary.
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file.slice(0, file.size, contentType), file.name);
    request.send(body);
  });
}

export async function completeUploadedDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/documents/${documentId}/complete`, { method: "POST" });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = errorResponseSchema.safeParse(body);
    throw new Error(error.success ? error.data.formError : "We couldn't start processing. Please try again.");
  }
}
