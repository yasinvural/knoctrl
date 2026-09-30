import { describe, expect, it } from "vitest";

import { validateWorkspaceResourceName } from "@/server/workspaces/names";

describe("validateWorkspaceResourceName", () => {
  it("trims a valid name and derives its comparison value", () => {
    expect(validateWorkspaceResourceName("  Client Research  ")).toEqual({
      status: "valid",
      value: {
        name: "Client Research",
        normalizedName: "client research",
      },
    });
  });

  it("rejects missing, whitespace-only, and overly long names", () => {
    expect(validateWorkspaceResourceName(undefined)).toEqual({
      status: "invalid",
      error: "Invalid input: expected string, received undefined",
    });
    expect(validateWorkspaceResourceName("   ")).toEqual({
      status: "invalid",
      error: "Enter a name.",
    });
    expect(validateWorkspaceResourceName("a".repeat(101))).toEqual({
      status: "invalid",
      error: "Names must be 100 characters or fewer.",
    });
  });
});
