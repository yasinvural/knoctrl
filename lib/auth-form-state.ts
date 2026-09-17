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
