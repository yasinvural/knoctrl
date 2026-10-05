"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, useCallback, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  initialWorkspaceDeleteFormState,
  type WorkspaceDeleteFormState,
} from "@/lib/workspace-form-state";
import { cn } from "@/lib/utils";

type DeleteResourceAction = (
  previousState: WorkspaceDeleteFormState,
  formData: FormData
) => Promise<WorkspaceDeleteFormState>;

type DeleteResourceDialogProps = {
  action: DeleteResourceAction;
  description: string;
  hiddenFields: Record<string, string>;
  title: string;
  triggerLabel: string;
  triggerAccessibleLabel?: string;
};

export function DeleteResourceDialog({
  action,
  description,
  hiddenFields,
  title,
  triggerLabel,
  triggerAccessibleLabel,
}: DeleteResourceDialogProps) {
  const [open, setOpen] = useState(false);
  const actionWithClose = useCallback<DeleteResourceAction>(
    async (previousState, formData) => {
      const nextState = await action(previousState, formData);

      if (nextState.status === "success") {
        setOpen(false);
      }

      return nextState;
    },
    [action]
  );
  const [state, formAction, isPending] = useActionState(
    actionWithClose,
    initialWorkspaceDeleteFormState
  );

  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setOpen(nextOpen);
        }
      }}
      open={open}
    >
      <Dialog.Trigger aria-label={triggerAccessibleLabel} className={cn(buttonVariants({ variant: "destructive" }))}>
        {triggerLabel}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup className="w-full max-w-md rounded-xl bg-card p-6 text-card-foreground shadow-lg outline-none">
            <Dialog.Title className="break-all font-heading text-lg font-medium">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 break-words text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
            <form action={formAction} className="mt-6 grid gap-3">
              {Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} name={name} type="hidden" value={value} />
              ))}
              <input name="confirmation" type="hidden" value="delete" />
              {state.status === "error" ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.formError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex justify-end gap-3">
                <Dialog.Close
                  className={cn(buttonVariants({ variant: "outline" }))}
                  disabled={isPending}
                  type="button"
                >
                  Cancel
                </Dialog.Close>
                <Button disabled={isPending} type="submit" variant="destructive">
                  {isPending ? "Deleting…" : "Delete permanently"}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
