"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialWorkspaceResourceFormState,
  type WorkspaceResourceFormState,
} from "@/lib/workspace-form-state";

type ResourceNameAction = (
  previousState: WorkspaceResourceFormState,
  formData: FormData
) => Promise<WorkspaceResourceFormState>;

type ResourceNameFormProps = {
  action: ResourceNameAction;
  hiddenFields?: Record<string, string>;
  initialName?: string;
  inputId: string;
  label: string;
  resetAfterSuccess?: boolean;
  submitLabel: string;
};

export function ResourceNameForm({
  action,
  hiddenFields,
  initialName = "",
  inputId,
  label,
  resetAfterSuccess = false,
  submitLabel,
}: ResourceNameFormProps) {
  const formReference = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    action,
    initialWorkspaceResourceFormState
  );
  const fieldError = state.status === "error" ? state.fieldError : undefined;

  useEffect(() => {
    if (resetAfterSuccess && state.status === "success") {
      formReference.current?.reset();
    }
  }, [resetAfterSuccess, state.status]);

  return (
    <form action={formAction} className="grid gap-3" noValidate ref={formReference}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))
        : null}
      {state.status === "error" && state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          aria-describedby={fieldError ? `${inputId}-error` : undefined}
          aria-invalid={Boolean(fieldError)}
          defaultValue={state.status === "error" ? state.name : initialName}
          id={inputId}
          maxLength={100}
          name="name"
          required
        />
        {fieldError ? (
          <p className="text-sm text-destructive" id={`${inputId}-error`}>
            {fieldError}
          </p>
        ) : null}
      </div>
      <Button disabled={isPending} type="submit" variant="outline">
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
