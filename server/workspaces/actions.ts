"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type {
  WorkspaceDeleteFormState,
  WorkspaceResourceFormState,
} from "@/lib/workspace-form-state";
import { getCurrentUser } from "@/server/auth/current-user";

import {
  createFolder,
  createWorkspace,
  deleteFolder,
  deleteWorkspace,
  renameFolder,
  renameWorkspace,
  type WorkspaceMutationResult,
} from "./workspace-service";

const resourceIdSchema = z.string().uuid();

function getStringValue(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

function getResourceId(formData: FormData, fieldName: string): string | null {
  const result = resourceIdSchema.safeParse(getStringValue(formData, fieldName));

  return result.success ? result.data : null;
}

function workspacePath(workspaceId: string): string {
  return `/app/workspaces/${workspaceId}`;
}

async function requireOwnerId(): Promise<string> {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    redirect("/sign-in");
  }

  return currentUser.user.id;
}

function toResourceFormState(
  result: WorkspaceMutationResult,
  name: string
): WorkspaceResourceFormState {
  if (result.status === "invalid" || result.status === "duplicate") {
    return {
      status: "error",
      name,
      fieldError: result.fieldError,
    };
  }

  if (result.status === "unavailable") {
    return {
      status: "error",
      name,
      formError: "This item is no longer available. Please refresh and try again.",
    };
  }

  return {
    status: "error",
    name,
    formError: "We couldn't save your changes. Please try again.",
  };
}

function invalidTargetState(): WorkspaceResourceFormState {
  return {
    status: "error",
    name: "",
    formError: "This item is no longer available. Please refresh and try again.",
  };
}

export async function createWorkspaceAction(
  _previousState: WorkspaceResourceFormState,
  formData: FormData
): Promise<WorkspaceResourceFormState> {
  const ownerId = await requireOwnerId();
  const name = getStringValue(formData, "name");
  const result = await createWorkspace(ownerId, name);

  if (result.status === "success") {
    revalidatePath("/app");
    return { status: "success" };
  }

  return toResourceFormState(result, name);
}

export async function renameWorkspaceAction(
  _previousState: WorkspaceResourceFormState,
  formData: FormData
): Promise<WorkspaceResourceFormState> {
  const ownerId = await requireOwnerId();
  const workspaceId = getResourceId(formData, "workspaceId");

  if (!workspaceId) {
    return invalidTargetState();
  }

  const name = getStringValue(formData, "name");
  const result = await renameWorkspace(ownerId, workspaceId, name);

  if (result.status === "success") {
    revalidatePath("/app");
    revalidatePath(workspacePath(workspaceId));
    return { status: "success" };
  }

  return toResourceFormState(result, name);
}

export async function deleteWorkspaceAction(
  _previousState: WorkspaceDeleteFormState,
  formData: FormData
): Promise<WorkspaceDeleteFormState> {
  const ownerId = await requireOwnerId();
  const workspaceId = getResourceId(formData, "workspaceId");

  if (!workspaceId || getStringValue(formData, "confirmation") !== "delete") {
    return {
      status: "error",
      formError: "Confirm deletion before permanently removing this workspace.",
    };
  }

  const result = await deleteWorkspace(ownerId, workspaceId);

  if (result.status === "success") {
    revalidatePath("/app");
    redirect("/app");
  }

  return {
    status: "error",
    formError:
      result.status === "unavailable"
        ? "This workspace is no longer available. Please refresh and try again."
        : "We couldn't delete this workspace. Please try again.",
  };
}

export async function createFolderAction(
  _previousState: WorkspaceResourceFormState,
  formData: FormData
): Promise<WorkspaceResourceFormState> {
  const ownerId = await requireOwnerId();
  const workspaceId = getResourceId(formData, "workspaceId");

  if (!workspaceId) {
    return invalidTargetState();
  }

  const name = getStringValue(formData, "name");
  const result = await createFolder(ownerId, workspaceId, name);

  if (result.status === "success") {
    revalidatePath(workspacePath(workspaceId));
    return { status: "success" };
  }

  return toResourceFormState(result, name);
}

export async function renameFolderAction(
  _previousState: WorkspaceResourceFormState,
  formData: FormData
): Promise<WorkspaceResourceFormState> {
  const ownerId = await requireOwnerId();
  const workspaceId = getResourceId(formData, "workspaceId");
  const folderId = getResourceId(formData, "folderId");

  if (!workspaceId || !folderId) {
    return invalidTargetState();
  }

  const name = getStringValue(formData, "name");
  const result = await renameFolder(ownerId, folderId, name);

  if (result.status === "success") {
    revalidatePath(workspacePath(workspaceId));
    return { status: "success" };
  }

  return toResourceFormState(result, name);
}

export async function deleteFolderAction(
  _previousState: WorkspaceDeleteFormState,
  formData: FormData
): Promise<WorkspaceDeleteFormState> {
  const ownerId = await requireOwnerId();
  const workspaceId = getResourceId(formData, "workspaceId");
  const folderId = getResourceId(formData, "folderId");

  if (
    !workspaceId ||
    !folderId ||
    getStringValue(formData, "confirmation") !== "delete"
  ) {
    return {
      status: "error",
      formError: "Confirm deletion before permanently removing this folder.",
    };
  }

  const result = await deleteFolder(ownerId, folderId);

  if (result.status === "success") {
    revalidatePath(workspacePath(workspaceId));
    return { status: "idle" };
  }

  return {
    status: "error",
    formError:
      result.status === "unavailable"
        ? "This folder is no longer available. Please refresh and try again."
        : "We couldn't delete this folder. Please try again.",
  };
}
