import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "@/server/config/env";

const validEnvironment = {
  DATABASE_URL: "postgresql://postgres:password@localhost:5432/knoctrl",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
};

describe("parseServerEnvironment", () => {
  it("returns validated server configuration", () => {
    expect(parseServerEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it("reports missing variables without exposing their values", () => {
    const secret = "secret-that-must-not-appear-in-errors";

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY");

    try {
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: secret,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
