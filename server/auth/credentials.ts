import "server-only";

import { z } from "zod";

export type { AuthFormState, SignOutFormState } from "@/lib/auth-form-state";

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type Credentials = z.infer<typeof credentialsSchema>;

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
