import { z } from "zod";

import { getCurrentUser } from "@/server/auth/current-user";
import {
  deleteDocument,
  reserveDocuments,
} from "@/server/documents/document-service";
import { createDocumentStorage } from "@/server/integrations/supabase/document-storage";

const uploadIntentSchema = z.object({
  workspaceId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
  files: z.array(
    z.object({
      filename: z.unknown(),
      contentType: z.unknown(),
      fileSize: z.unknown(),
    })
  ),
});

function jsonError(message: string, status: number) {
  return Response.json({ status: "error", formError: message }, { status });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    return jsonError("Sign in to upload documents.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadIntentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Send valid upload metadata.", 400);
  }

  const reservation = await reserveDocuments(currentUser.user.id, parsed.data);

  if (reservation.status !== "success") {
    const status =
      reservation.status === "unavailable"
        ? 404
        : reservation.status === "quota" || reservation.status === "duplicate"
          ? 409
          : 400;

    return Response.json(reservation, { status });
  }

  const storage = createDocumentStorage();
  const signedUploads = await Promise.all(
    reservation.documents.map(async (document) => {
      const result = await storage.createSignedUploadUrl(document.storageKey);

      return result.error
        ? null
        : {
            documentId: document.id,
            filename: document.filename,
            signedUrl: result.data.signedUrl,
          };
    })
  );

  if (signedUploads.some((upload) => upload === null)) {
    await Promise.all(
      reservation.documents.map((document) =>
        deleteDocument(currentUser.user.id, document.id)
      )
    );

    return jsonError("We couldn't prepare these files for upload. Please try again.", 503);
  }

  return Response.json(
    {
      status: "success",
      uploads: signedUploads,
      rejectedFiles: reservation.rejectedFiles,
    },
    { status: 201 }
  );
}
