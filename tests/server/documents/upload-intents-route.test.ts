import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const reserveDocuments = vi.hoisted(() => vi.fn());
const deleteDocument = vi.hoisted(() => vi.fn());
const createSignedUploadUrl = vi.hoisted(() => vi.fn());
const createDocumentStorage = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/server/documents/document-service", () => ({
  deleteDocument,
  reserveDocuments,
}));
vi.mock("@/server/integrations/supabase/document-storage", () => ({
  createDocumentStorage,
}));

import { POST } from "@/app/api/documents/upload-intents/route";

const requestBody = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  files: [
    {
      filename: "notes.txt",
      contentType: "text/plain",
      fileSize: 10,
    },
  ],
};

describe("POST /api/documents/upload-intents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "owner-1" },
    });
    createDocumentStorage.mockReturnValue({ createSignedUploadUrl });
  });

  it("requires an authenticated owner", async () => {
    getCurrentUser.mockResolvedValue({ status: "unauthenticated" });

    const response = await POST(
      new Request("http://localhost/api/documents/upload-intents", {
        method: "POST",
        body: JSON.stringify(requestBody),
      })
    );

    expect(response.status).toBe(401);
    expect(reserveDocuments).not.toHaveBeenCalled();
  });

  it("returns signed URLs only for successful owned reservations", async () => {
    reserveDocuments.mockResolvedValue({
      status: "success",
      rejectedFiles: [],
      documents: [
        {
          id: "document-1",
          filename: "notes.txt",
          storageKey: "owner-1/generated-key",
        },
      ],
    });
    createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/upload" },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/documents/upload-intents", {
        method: "POST",
        body: JSON.stringify(requestBody),
      })
    );

    expect(reserveDocuments).toHaveBeenCalledWith("owner-1", requestBody);
    expect(createSignedUploadUrl).toHaveBeenCalledWith("owner-1/generated-key");
    await expect(response.json()).resolves.toEqual({
      status: "success",
      uploads: [
        {
          documentId: "document-1",
          filename: "notes.txt",
          signedUrl: "https://storage.example/upload",
        },
      ],
      rejectedFiles: [],
    });
  });

  it("releases every reservation when Storage cannot issue an upload URL", async () => {
    reserveDocuments.mockResolvedValue({
      status: "success",
      rejectedFiles: [],
      documents: [{ id: "document-1", filename: "notes.txt", storageKey: "owner-1/key" }],
    });
    createSignedUploadUrl.mockResolvedValue({ data: null, error: new Error("unavailable") });
    deleteDocument.mockResolvedValue({ status: "success" });

    const response = await POST(
      new Request("http://localhost/api/documents/upload-intents", {
        method: "POST",
        body: JSON.stringify(requestBody),
      })
    );

    expect(response.status).toBe(503);
    expect(deleteDocument).toHaveBeenCalledWith("owner-1", "document-1");
  });
});
