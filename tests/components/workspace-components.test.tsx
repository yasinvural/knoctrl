/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AuthenticatedHeader } from "@/components/workspaces/authenticated-header";
import { CreateWorkspaceForm } from "@/components/workspaces/create-workspace-form";
import type { WorkspaceResourceFormState } from "@/lib/workspace-form-state";

async function duplicateWorkspaceName(
  previousState: WorkspaceResourceFormState,
  formData: FormData
): Promise<WorkspaceResourceFormState> {
  void previousState;
  void formData;

  return {
    status: "error",
    name: "Research",
    fieldError: "You already have a workspace with that name.",
  };
}

describe("workspace components", () => {
  it("labels workspace creation input and reports an action field error", async () => {
    const user = userEvent.setup();

    render(<CreateWorkspaceForm action={duplicateWorkspaceName} />);

    expect(screen.getByLabelText("Workspace name")).toHaveAttribute(
      "maxLength",
      "100"
    );

    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("You already have a workspace with that name.")).toBeVisible();
  });

  it("provides an accessible sign-out badge in the authenticated header", () => {
    render(<AuthenticatedHeader email="person@example.com" />);

    expect(
      screen.getByRole("link", { name: "KnowledgeControl" })
    ).toHaveAttribute("href", "/app");
    expect(
      screen.getByRole("button", { name: "Sign out person@example.com" })
    ).toHaveTextContent("P");
  });
});
