import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const getDocumentCompletionCandidate = vi.hoisted(() => vi.fn());
const completeDocumentUpload = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
const createDocumentStorage = vi.hoisted(() => vi.fn());
const createInngestClient = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/server/documents/document-service", () => ({
  completeDocumentUpload,
  getDocumentCompletionCandidate,
}));
vi.mock("@/server/integrations/supabase/document-storage", () => ({
  createDocumentStorage,
}));
vi.mock("@/server/integrations/inngest/client", () => ({ createInngestClient }));

import { POST } from "@/app/api/documents/[documentId]/complete/route";

const documentId = "00000000-0000-4000-8000-000000000001";

describe("POST /api/documents/:documentId/complete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "owner-1" },
    });
    createDocumentStorage.mockReturnValue({ list });
    createInngestClient.mockReturnValue({ send });
    getDocumentCompletionCandidate.mockResolvedValue({
      status: "success",
      document: {
        id: documentId,
        storageKey: "owner-1/generated-key",
        contentType: "text/plain",
        fileSize: 10,
        processingAttempt: 1,
        uploadedAt: null,
      },
    });
  });

  it("does not disclose a document unavailable to the authenticated owner", async () => {
    getDocumentCompletionCandidate.mockResolvedValue({ status: "unavailable" });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ documentId }),
    });

    expect(response.status).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });

  it("verifies the reserved object and sends an idempotent processing event", async () => {
    list.mockResolvedValue({
      data: [
        {
          name: "generated-key",
          metadata: { size: 10, mimetype: "text/plain" },
        },
      ],
      error: null,
    });
    completeDocumentUpload.mockResolvedValue({ status: "success", processingAttempt: 1 });
    send.mockResolvedValue({ ids: ["event-1"] });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ documentId }),
    });

    expect(list).toHaveBeenCalledWith("owner-1", {
      limit: 100,
      search: "generated-key",
    });
    expect(completeDocumentUpload).toHaveBeenCalledWith("owner-1", documentId);
    expect(send).toHaveBeenCalledWith({
      id: `${documentId}:1`,
      name: "documents/process.requested",
      data: { documentId, processingAttempt: 1 },
    });
    expect(response.status).toBe(202);
  });

  it("does not complete or enqueue a missing or mismatched Storage object", async () => {
    list.mockResolvedValue({ data: [], error: null });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ documentId }),
    });

    expect(response.status).toBe(409);
    expect(completeDocumentUpload).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
