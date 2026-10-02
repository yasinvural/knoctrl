import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  process: vi.fn(), fail: vi.fn(), expire: vi.fn(), cleanup: vi.fn(),
  documents: vi.fn(), tasks: vi.fn(), logger: { info: vi.fn() },
}));
vi.mock("@/server/documents/processing", () => ({ processDocument: mocks.process, failDocument: mocks.fail }));
vi.mock("@/server/documents/document-service", () => ({ expireDocumentUpload: mocks.expire }));
vi.mock("@/server/documents/storage-cleanup", () => ({ cleanupStorageTask: mocks.cleanup }));
vi.mock("@/server/db/prisma", () => ({ prisma: {
  document: { findMany: mocks.documents }, storageCleanupTask: { findMany: mocks.tasks },
} }));
vi.mock("@/server/integrations/inngest/client", () => ({
  createInngestClient: () => ({ createFunction: (options: unknown, handler: unknown) => ({ options, handler }) }),
}));

import { documentFunctions } from "@/server/inngest/functions";

// The mock returns boundary hooks rather than real Inngest instances.
type Workflow = {
  options: { id: string; retries?: number; onFailure?: (input: { event: { data: { event: { data: unknown } } } }) => Promise<void> };
  handler: (input: {
    event: { data: unknown };
    step: { run: (name: string, callback: () => unknown) => Promise<unknown>; sendEvent: ReturnType<typeof vi.fn> };
    logger: typeof mocks.logger;
  }) => Promise<unknown>;
};

function workflow(id: string): Workflow {
  const registered: unknown[] = documentFunctions;
  const candidate = registered.find((entry) => {
    if (!entry || typeof entry !== "object" || !("options" in entry)) return false;
    const options = entry.options;
    return options !== null && typeof options === "object" && "id" in options && options.id === id;
  });
  if (!candidate || typeof candidate !== "object" || !("handler" in candidate)) throw new Error("Missing workflow");
  // Only the test's createFunction factory supplies this object.
  return candidate as Workflow;
}

const request = { documentId: "00000000-0000-4000-8000-000000000001", processingAttempt: 2 };

describe("document workflow orchestration", () => {
  beforeEach(() => vi.resetAllMocks());

  function context(data: unknown = request) {
    return { event: { data }, logger: mocks.logger, step: {
      run: async (_name: string, callback: () => unknown) => callback(), sendEvent: vi.fn(),
    } };
  }

  it("runs valid processing and logs only safe outcome metadata", async () => {
    mocks.process.mockResolvedValue("available");
    const fn = workflow("process-document");
    expect(fn.options.retries).toBe(3);
    await expect(fn.handler(context())).resolves.toEqual({ outcome: "available" });
    expect(mocks.process).toHaveBeenCalledWith(request);
    expect(mocks.logger.info).toHaveBeenCalledWith("document_processing", { outcome: "available", processingAttempt: 2 });
  });

  it("does not process an invalid event", async () => {
    await expect(workflow("process-document").handler(context({ documentId: "invalid", processingAttempt: 0 }))).rejects.toThrow();
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("marks only a validated exhausted attempt failed", async () => {
    const onFailure = workflow("process-document").options.onFailure;
    if (!onFailure) throw new Error("Missing failure hook");
    await onFailure({ event: { data: { event: { data: request } } } });
    expect(mocks.fail).toHaveBeenCalledWith(request);
    await onFailure({ event: { data: { event: { data: {} } } } });
    expect(mocks.fail).toHaveBeenCalledOnce();
  });

  it("expires abandoned reservations through the owned transactional service", async () => {
    mocks.documents.mockResolvedValue([{ id: request.documentId, workspace: { ownerId: "owner-1" } }]);
    await workflow("expire-upload-reservations").handler(context());
    expect(mocks.expire).toHaveBeenCalledWith("owner-1", request.documentId);
    expect(mocks.documents).toHaveBeenCalledWith(expect.objectContaining({ take: 100, where: expect.objectContaining({ uploadedAt: null }) }));
  });

  it("dispatches pending cleanup tasks for durable retries", async () => {
    mocks.tasks.mockResolvedValue([{ id: request.documentId }]);
    const ctx = context();
    await workflow("sweep-document-storage-cleanup").handler(ctx);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("dispatch-cleanup", [{
      name: "documents/storage-cleanup.requested", data: { taskId: request.documentId },
    }]);
  });

  it("runs cleanup independently of a now-deleted document", async () => {
    mocks.cleanup.mockResolvedValue("completed");
    await expect(workflow("cleanup-document-storage").handler(context({ taskId: request.documentId })))
      .resolves.toEqual({ outcome: "completed" });
    expect(mocks.cleanup).toHaveBeenCalledWith(request.documentId);
  });
});
