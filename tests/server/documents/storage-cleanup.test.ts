import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tasks: { findFirst: vi.fn(), updateMany: vi.fn() }, remove: vi.fn(),
}));
vi.mock("@/server/db/prisma", () => ({ prisma: { storageCleanupTask: mocks.tasks } }));
vi.mock("@/server/integrations/supabase/document-storage", () => ({
  createDocumentStorage: () => ({ remove: mocks.remove }),
}));
import { cleanupStorageTask } from "@/server/documents/storage-cleanup";

describe("Storage cleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.tasks.findFirst.mockResolvedValue({ id: "task", storageKey: "private/key", createdAt: new Date(0) });
    mocks.remove.mockResolvedValue({ error: null });
  });
  it("completes an idempotent removal beyond token expiry", async () => {
    await expect(cleanupStorageTask("task")).resolves.toBe("completed");
    expect(mocks.remove).toHaveBeenCalledWith(["private/key"]);
    expect(mocks.tasks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "completed", lastErrorCode: null }),
    }));
  });
  it("keeps cleanup durable on a provider failure and sanitizes the retry error", async () => {
    mocks.remove.mockResolvedValue({ error: new Error("private/key") });
    await expect(cleanupStorageTask("task")).rejects.toThrow("Document storage cleanup unavailable.");
    expect(mocks.tasks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { lastErrorCode: "storage_unavailable" } }));
  });
  it("removes promptly but schedules another removal after outstanding tokens expire", async () => {
    mocks.tasks.findFirst.mockResolvedValue({ id: "task", storageKey: "private/key", createdAt: new Date() });
    await expect(cleanupStorageTask("task")).resolves.toBe("removed_waiting_for_expiry");
    expect(mocks.tasks.updateMany).toHaveBeenCalledTimes(1);
  });
  it("ignores tasks already completed or missing", async () => {
    mocks.tasks.findFirst.mockResolvedValue(null);
    await expect(cleanupStorageTask("task")).resolves.toBe("skipped");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
