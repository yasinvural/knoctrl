import { z } from "zod";

import { getCurrentUser } from "@/server/auth/current-user";
import {
  completeDocumentUpload,
  getDocumentCompletionCandidate,
} from "@/server/documents/document-service";
import { createInngestClient } from "@/server/integrations/inngest/client";
import { createDocumentStorage } from "@/server/integrations/supabase/document-storage";

const routeParamsSchema = z.object({ documentId: z.string().uuid() });

function jsonError(message: string, status: number) {
  return Response.json({ status: "error", formError: message }, { status });
}

function storageObjectMatches(
  object: { name: string; metadata: { size: number; mimetype: string } | null } | undefined,
  filename: string,
  fileSize: number,
  contentType: string
): boolean {
  return (
    object?.name === filename &&
    object.metadata?.size === fileSize &&
    object.metadata.mimetype === contentType
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    return jsonError("Sign in to complete an upload.", 401);
  }

  const parsedParams = routeParamsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return jsonError("This document is no longer available.", 404);
  }

  const candidate = await getDocumentCompletionCandidate(
    currentUser.user.id,
    parsedParams.data.documentId
  );

  if (candidate.status === "unavailable") {
    return jsonError("This document is no longer available.", 404);
  }

  if (candidate.status === "invalid_state") {
    return jsonError("This document can't be completed.", 409);
  }

  const pathSegments = candidate.document.storageKey.split("/");
  const filename = pathSegments.at(-1);
  const ownerPath = pathSegments.slice(0, -1).join("/");

  if (!filename || !ownerPath) {
    return jsonError("This document can't be completed.", 409);
  }

  const storage = createDocumentStorage();
  const listed = await storage.list(ownerPath, { limit: 100, search: filename });
  const object = listed.data?.find((item) => item.name === filename);

  if (listed.error || !storageObjectMatches(
    object,
    filename,
    candidate.document.fileSize,
    candidate.document.contentType
  )) {
    return jsonError("The uploaded file could not be verified. Please upload it again.", 409);
  }

  const completion = await completeDocumentUpload(
    currentUser.user.id,
    candidate.document.id
  );

  if (completion.status === "unavailable") {
    return jsonError("This document is no longer available.", 404);
  }

  if (completion.status === "invalid_state" || completion.status === "conflict") {
    return jsonError("This document can't be completed.", 409);
  }

  if (completion.status === "error") {
    return jsonError("We couldn't complete this upload. Please try again.", 503);
  }

  try {
    await createInngestClient().send({
      id: `${candidate.document.id}:${completion.processingAttempt}`,
      name: "documents/process.requested",
      data: {
        documentId: candidate.document.id,
        processingAttempt: completion.processingAttempt,
      },
    });
  } catch {
    return jsonError("The upload is saved but processing could not be started. Please retry.", 503);
  }

  return Response.json({ status: "success" }, { status: 202 });
}
