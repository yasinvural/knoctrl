import "server-only";

import type { Credentials, SignOutFormState } from "@/server/auth/credentials";

type CredentialAuthenticationClient = {
  auth: {
    signInWithPassword: (credentials: Credentials) => Promise<{
      error: unknown;
    }>;
    signUp: (credentials: Credentials) => Promise<{
      data: { session: unknown | null };
      error: unknown;
    }>;
  };
};

type SignOutClient = {
  auth: {
    signOut: () => Promise<{ error: unknown }>;
  };
};

export async function registerWithPassword(
  client: CredentialAuthenticationClient,
  credentials: Credentials
): Promise<boolean> {
  try {
    const { data, error } = await client.auth.signUp(credentials);

    return !error && Boolean(data.session);
  } catch {
    return false;
  }
}

export async function signInWithPassword(
  client: CredentialAuthenticationClient,
  credentials: Credentials
): Promise<boolean> {
  try {
    const { error } = await client.auth.signInWithPassword(credentials);

    return !error;
  } catch {
    return false;
  }
}

export async function signOutFromClient(
  client: SignOutClient
): Promise<SignOutFormState> {
  try {
    const { error } = await client.auth.signOut();

    if (!error) {
      return { status: "idle" };
    }
  } catch {
    // A sign-out failure must keep the user on the authenticated page.
  }

  return {
    status: "error",
    formError: "We couldn't sign you out. Please try again.",
  };
}
