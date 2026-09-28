/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteResourceDialog } from "@/components/workspaces/delete-resource-dialog";
import type { WorkspaceDeleteFormState } from "@/lib/workspace-form-state";

describe("DeleteResourceDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("cancels without submitting and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const deleteAction = vi.fn(
      async (): Promise<WorkspaceDeleteFormState> => ({ status: "success" })
    );

    render(
      <DeleteResourceDialog
        action={deleteAction}
        description="This cannot be undone."
        hiddenFields={{ workspaceId: "3f9a0c4d-8bc4-4e6d-a46c-d431d6b769a4" }}
        title="Delete Research?"
        triggerLabel="Delete workspace"
      />
    );

    const trigger = screen.getByRole("button", { name: "Delete workspace" });
    await user.click(trigger);

    expect(await screen.findByText("Delete Research?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Delete Research?")).not.toBeInTheDocument();
    });
    expect(deleteAction).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("submits an explicit delete confirmation", async () => {
    const user = userEvent.setup();
    let submittedConfirmation: FormDataEntryValue | null = null;

    async function deleteAction(
      _previousState: WorkspaceDeleteFormState,
      formData: FormData
    ): Promise<WorkspaceDeleteFormState> {
      submittedConfirmation = formData.get("confirmation");
      return { status: "success" };
    }

    render(
      <DeleteResourceDialog
        action={deleteAction}
        description="This cannot be undone."
        hiddenFields={{ workspaceId: "3f9a0c4d-8bc4-4e6d-a46c-d431d6b769a4" }}
        title="Delete Research?"
        triggerLabel="Delete workspace"
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete workspace" }));
    await user.click(
      await screen.findByRole("button", { name: "Delete permanently" })
    );

    await waitFor(() => {
      expect(submittedConfirmation).toBe("delete");
    });
  });
});
