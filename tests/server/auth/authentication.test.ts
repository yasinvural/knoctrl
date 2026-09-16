import { describe, expect, it } from "vitest";

import {
  registerWithPassword,
  signInWithPassword,
  signOutFromClient,
} from "@/server/auth/authentication";

const credentials = {
  email: "person@example.com",
  password: "password",
};

describe("registerWithPassword", () => {
  it("requires Supabase to return a session", async () => {
    const registered = await registerWithPassword(
      {
        auth: {
          async signInWithPassword() {
            return { error: null };
          },
          async signUp() {
            return { data: { session: null }, error: null };
          },
        },
      },
      credentials
    );

    expect(registered).toBe(false);
  });
});

describe("signInWithPassword", () => {
  it("rejects failed credentials", async () => {
    const signedIn = await signInWithPassword(
      {
        auth: {
          async signInWithPassword() {
            return { error: new Error("Invalid login credentials") };
          },
          async signUp() {
            return { data: { session: null }, error: null };
          },
        },
      },
      credentials
    );

    expect(signedIn).toBe(false);
  });
});

describe("signOutFromClient", () => {
  it("returns a safe error when Supabase cannot end the session", async () => {
    const result = await signOutFromClient({
      auth: {
        async signOut() {
          return { error: new Error("Service unavailable") };
        },
      },
    });

    expect(result).toEqual({
      status: "error",
      formError: "We couldn't sign you out. Please try again.",
    });
  });
});
