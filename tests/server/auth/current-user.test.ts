import { describe, expect, it } from "vitest";

import { resolveCurrentUser } from "@/server/auth/current-user";

describe("resolveCurrentUser", () => {
  it("returns an authenticated result for a verified user", async () => {
    const result = await resolveCurrentUser({
      async getUser() {
        return { data: { user: { id: "user-123" } }, error: null };
      },
    });

    expect(result).toEqual({
      status: "authenticated",
      user: { id: "user-123" },
    });
  });

  it("returns an unauthenticated result when Supabase denies the session", async () => {
    const result = await resolveCurrentUser({
      async getUser() {
        return { data: { user: null }, error: new Error("Invalid session") };
      },
    });

    expect(result).toEqual({ status: "unauthenticated" });
  });
});
