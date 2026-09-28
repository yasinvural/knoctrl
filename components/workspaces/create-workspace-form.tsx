"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceAction,
} from "@/server/workspaces/actions";
import {
  initialWorkspaceResourceFormState,
  type WorkspaceResourceFormState,
} from "@/lib/workspace-form-state";

type CreateWorkspaceAction = (
  previousState: WorkspaceResourceFormState,
  formData: FormData
) => Promise<WorkspaceResourceFormState>;

type CreateWorkspaceFormProps = {
  action?: CreateWorkspaceAction;
};

export function CreateWorkspaceForm({
  action = createWorkspaceAction,
}: CreateWorkspaceFormProps) {
  const formReference = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    action,
    initialWorkspaceResourceFormState
  );
  const fieldError = state.status === "error" ? state.fieldError : undefined;

  useEffect(() => {
    if (state.status === "success") {
      formReference.current?.reset();
    }
  }, [state.status]);

  return (
    <form action={formAction} className="grid gap-4" noValidate ref={formReference}>
      {state.status === "error" && state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          aria-describedby={fieldError ? "workspace-name-error" : undefined}
          aria-invalid={Boolean(fieldError)}
          defaultValue={state.status === "error" ? state.name : ""}
          id="workspace-name"
          maxLength={100}
          name="name"
          required
        />
        {fieldError ? (
          <p className="text-sm text-destructive" id="workspace-name-error">
            {fieldError}
          </p>
        ) : null}
      </div>
      <Button disabled={isPending} type="submit">
        {isPending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
