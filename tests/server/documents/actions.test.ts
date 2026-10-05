import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), revalidate: vi.fn(), redirect: vi.fn(),
  retry: vi.fn(), delete: vi.fn(), cancel: vi.fn(), send: vi.fn(), fail: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/documents/document-service", () => ({ retryDocument: mocks.retry, deleteDocument: mocks.delete, cancelDocumentUpload: mocks.cancel }));
vi.mock("@/server/documents/processing", () => ({ failDocument: mocks.fail }));
vi.mock("@/server/integrations/inngest/client", () => ({ createInngestClient: () => ({ send: mocks.send }) }));

import { cancelDocumentUploadAction, deleteDocumentAction, retryDocumentAction } from "@/server/documents/actions";

const documentId = "00000000-0000-4000-8000-000000000001";
function form(confirmation?: string) {
  const data = new FormData();
  data.set("documentId", documentId);
  if (confirmation) data.set("confirmation", confirmation);
  return data;
}

describe("document actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ status: "authenticated", user: { id: "owner-1" } });
    mocks.retry.mockResolvedValue({ status: "success", processingAttempt: 2 });
  });

  it("dispatches an owned retry using the new attempt and refreshes document views", async () => {
    await expect(retryDocumentAction({ status: "idle" }, form())).resolves.toEqual({ status: "success" });
    expect(mocks.retry).toHaveBeenCalledWith("owner-1", documentId);
    expect(mocks.send).toHaveBeenCalledWith({ id: `${documentId}:2`, name: "documents/process.requested", data: { documentId, processingAttempt: 2 } });
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/workspaces/[workspaceId]", "page");
  });

  it("restores a retryable failed state when event dispatch fails", async () => {
    mocks.send.mockRejectedValue(new Error("private provider error"));
    await expect(retryDocumentAction({ status: "idle" }, form())).resolves.toEqual({ status: "error", formError: "We couldn't start processing. Please retry this file." });
    expect(mocks.fail).toHaveBeenCalledWith({ documentId, processingAttempt: 2 }, "dispatch_failed");
  });

  it("requires an explicit confirmation before document deletion", async () => {
    await expect(deleteDocumentAction({ status: "idle" }, form())).resolves.toMatchObject({ status: "error" });
    expect(mocks.delete).not.toHaveBeenCalled();
    mocks.delete.mockResolvedValue({ status: "success" });
    await expect(deleteDocumentAction({ status: "idle" }, form("delete"))).resolves.toEqual({ status: "success" });
    expect(mocks.delete).toHaveBeenCalledWith("owner-1", documentId);
  });

  it("does not dispatch events for an unavailable or invalid document", async () => {
    mocks.retry.mockResolvedValue({ status: "unavailable" });
    await expect(retryDocumentAction({ status: "idle" }, form())).resolves.toMatchObject({ status: "error" });
    await expect(retryDocumentAction({ status: "idle" }, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(mocks.retry).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("requires authentication for cancellation as well as mutations", async () => {
    mocks.user.mockResolvedValue({ status: "unauthenticated" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    await expect(cancelDocumentUploadAction(documentId)).rejects.toThrow("redirect");
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
