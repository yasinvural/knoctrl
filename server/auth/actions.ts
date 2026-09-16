"use server";

import { redirect } from "next/navigation";

import {
  registerWithPassword,
  signInWithPassword,
  signOutFromClient,
} from "@/server/auth/authentication";
import {
  type AuthFormState,
  type SignOutFormState,
  validateCredentials,
} from "@/server/auth/credentials";
import { createSupabaseServerActionClient } from "@/server/auth/server-action-client";

export async function register(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const result = validateCredentials(formData);

  if (result.status === "invalid") {
    return {
      status: "error",
      email: result.email,
      fieldErrors: result.fieldErrors,
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const registered = await registerWithPassword(supabase, result.credentials);

  if (!registered) {
    return {
      status: "error",
      email: result.credentials.email,
      formError: "We couldn't create your account. Please try again.",
    };
  }

  redirect("/app");
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const result = validateCredentials(formData);

  if (result.status === "invalid") {
    return {
      status: "error",
      email: result.email,
      fieldErrors: result.fieldErrors,
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const signedIn = await signInWithPassword(supabase, result.credentials);

  if (!signedIn) {
    return {
      status: "error",
      email: result.credentials.email,
      formError: "We couldn't sign you in with those credentials.",
    };
  }

  redirect("/app");
}

export async function signOut(
  previousState: SignOutFormState,
  formData: FormData
): Promise<SignOutFormState> {
  void previousState;
  void formData;

  const supabase = await createSupabaseServerActionClient();
  const result = await signOutFromClient(supabase);

  if (result.status === "error") {
    return result;
  }

  redirect("/");
}
