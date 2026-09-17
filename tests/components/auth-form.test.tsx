/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";
import type { AuthFormState } from "@/lib/auth-form-state";

async function failedSignIn(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  void previousState;
  void formData;

  return {
    status: "error",
    email: "person@example.com",
    formError: "We couldn't sign you in with those credentials.",
  };
}

describe("AuthForm", () => {
  it("labels credential fields and displays a server action error", async () => {
    const user = userEvent.setup();

    render(
      <AuthForm
        action={failedSignIn}
        alternativeHref="/sign-up"
        alternativeLabel="Create an account"
        alternativeText="New to KnowledgeControl?"
        submitLabel="Sign in"
        title="Welcome back"
      />
    );

    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "type",
      "email"
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password"
    );
    expect(
      screen.getByRole("link", { name: "Create an account" })
    ).toHaveAttribute("href", "/sign-up");

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign you in with those credentials."
    );
  });
});
