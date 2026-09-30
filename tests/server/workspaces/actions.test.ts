import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheMock = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));
const currentUserMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));
const navigationMock = vi.hoisted(() => ({
  redirect: vi.fn(),
}));
const workspaceServiceMock = vi.hoisted(() => ({
  createFolder: vi.fn(),
  createWorkspace: vi.fn(),
  deleteFolder: vi.fn(),
  deleteWorkspace: vi.fn(),
  renameFolder: vi.fn(),
  renameWorkspace: vi.fn(),
}));

vi.mock("next/cache", () => cacheMock);
vi.mock("next/navigation", () => navigationMock);
vi.mock("@/server/auth/current-user", () => currentUserMock);
vi.mock("@/server/workspaces/workspace-service", () => workspaceServiceMock);

import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  renameWorkspaceAction,
} from "@/server/workspaces/actions";

const workspaceId = "3f9a0c4d-8bc4-4e6d-a46c-d431d6b769a4";

function createFormData(values: Record<string, string>): FormData {
  const formData = new FormData();

  Object.entries(values).forEach(([name, value]) => {
    formData.set(name, value);
  });

  return formData;
}

describe("workspace actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUserMock.getCurrentUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "d7d1f0c4-bd28-419c-8e4d-1913b4f8315d" },
    });
  });

  it("maps a duplicate workspace name to a field error", async () => {
    workspaceServiceMock.createWorkspace.mockResolvedValue({
      status: "duplicate",
      fieldError: "You already have a workspace with that name.",
    });

    await expect(
      createWorkspaceAction(
        { status: "idle" },
        createFormData({ name: "Research" })
      )
    ).resolves.toEqual({
      status: "error",
      name: "Research",
      fieldError: "You already have a workspace with that name.",
    });
    expect(workspaceServiceMock.createWorkspace).toHaveBeenCalledWith(
      "d7d1f0c4-bd28-419c-8e4d-1913b4f8315d",
      "Research"
    );
  });

  it("revalidates the index and detail routes after a workspace rename", async () => {
    workspaceServiceMock.renameWorkspace.mockResolvedValue({
      status: "success",
    });

    await expect(
      renameWorkspaceAction(
        { status: "idle" },
        createFormData({
          workspaceId,
          name: "Client Research",
        })
      )
    ).resolves.toEqual({ status: "success" });
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/app");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith(
      `/app/workspaces/${workspaceId}`
    );
  });

  it("requires an explicit delete confirmation before deleting a workspace", async () => {
    await expect(
      deleteWorkspaceAction(
        { status: "idle" },
        createFormData({ workspaceId })
      )
    ).resolves.toEqual({
      status: "error",
      formError: "Confirm deletion before permanently removing this workspace.",
    });
    expect(workspaceServiceMock.deleteWorkspace).not.toHaveBeenCalled();
  });
});
