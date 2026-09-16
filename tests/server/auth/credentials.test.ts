import { describe, expect, it } from "vitest";

import { validateCredentials } from "@/server/auth/credentials";

describe("validateCredentials", () => {
  it("returns field errors without retaining the password", () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "sensitive-password");

    const result = validateCredentials(formData);

    expect(result).toMatchObject({
      status: "invalid",
      email: "not-an-email",
      fieldErrors: {
        email: ["Enter a valid email address."],
      },
    });
    expect(JSON.stringify(result)).not.toContain("sensitive-password");
  });
});
