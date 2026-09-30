import "server-only";

import { z } from "zod";

export const workspaceResourceNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(100, "Names must be 100 characters or fewer.");

export type WorkspaceResourceName = z.infer<typeof workspaceResourceNameSchema>;

export type ValidatedWorkspaceResourceName = {
  name: WorkspaceResourceName;
  normalizedName: string;
};

export type WorkspaceResourceNameValidation =
  | { status: "valid"; value: ValidatedWorkspaceResourceName }
  | { status: "invalid"; error: string };

export function validateWorkspaceResourceName(
  input: unknown
): WorkspaceResourceNameValidation {
  const result = workspaceResourceNameSchema.safeParse(input);

  if (!result.success) {
    return {
      status: "invalid",
      error: result.error.issues[0]?.message ?? "Enter a valid name.",
    };
  }

  return {
    status: "valid",
    value: {
      name: result.data,
      normalizedName: result.data.toLowerCase(),
    },
  };
}
