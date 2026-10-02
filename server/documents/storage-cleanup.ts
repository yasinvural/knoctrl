import "server-only";

import { prisma } from "@/server/db/prisma";
import { createDocumentStorage } from "@/server/integrations/supabase/document-storage";

export async function cleanupStorageTask(taskId: string): Promise<"completed" | "removed_waiting_for_expiry" | "skipped"> {
  const task = await prisma.storageCleanupTask.findFirst({
    where: { id: taskId, status: "pending" },
    select: { id: true, storageKey: true, createdAt: true },
  });
  if (!task) return "skipped";
  await prisma.storageCleanupTask.updateMany({
    where: { id: task.id, status: "pending" },
    data: { attemptCount: { increment: 1 } },
  });
  try {
    const removed = await createDocumentStorage().remove([task.storageKey]);
    if (removed.error) throw new Error("Storage removal failed.");
  } catch {
    await prisma.storageCleanupTask.updateMany({
      where: { id: task.id, status: "pending" },
      data: { lastErrorCode: "storage_unavailable" },
    });
    throw new Error("Document storage cleanup unavailable.");
  }
  // Remove promptly, then retain a final sweep beyond signed-token validity.
  // A late upload using an already-issued URL must not leave an orphan.
  if (task.createdAt.getTime() > Date.now() - 125 * 60 * 1000) {
    return "removed_waiting_for_expiry";
  }
  await prisma.storageCleanupTask.updateMany({
    where: { id: task.id, status: "pending" },
    data: { status: "completed", completedAt: new Date(), lastErrorCode: null },
  });
  return "completed";
}
