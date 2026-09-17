import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { refreshSupabaseSession } from "@/server/auth/session-proxy";

describe("refreshSupabaseSession", () => {
  it("copies refreshed Supabase cookies to the response", async () => {
    const request = new NextRequest("http://localhost:3000/app");

    const response = await refreshSupabaseSession(request, (cookieMethods) => ({
      auth: {
        async getClaims() {
          cookieMethods.setAll?.([
            {
              name: "sb-access-token",
              options: { httpOnly: true, path: "/" },
              value: "refreshed-token",
            },
          ]);
        },
      },
    }));

    expect(response.cookies.get("sb-access-token")?.value).toBe(
      "refreshed-token"
    );
  });
});
