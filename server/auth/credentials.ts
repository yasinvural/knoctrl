import "server-only";

import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export type AuthFormState =
  | { status: "idle" }
  | {
      status: "error";
      email: string;
      fieldErrors?: {
        email?: string[];
        password?: string[];
      };
      formError?: string;
    };

export type SignOutFormState =
  | { status: "idle" }
  | { status: "error"; formError: string };

export const initialAuthFormState: AuthFormState = { status: "idle" };
export const initialSignOutFormState: SignOutFormState = { status: "idle" };

export function validateCredentials(formData: FormData):
  | { status: "valid"; credentials: Credentials }
  | {
      status: "invalid";
      email: string;
      fieldErrors: { email?: string[]; password?: string[] };
    } {
  const email = formData.get("email");
  const password = formData.get("password");
  const result = credentialsSchema.safeParse({
    email: typeof email === "string" ? email : "",
    password: typeof password === "string" ? password : "",
  });

  if (result.success) {
    return { status: "valid", credentials: result.data };
  }

  return {
    status: "invalid",
    email: typeof email === "string" ? email : "",
    fieldErrors: result.error.flatten().fieldErrors,
  };
}
