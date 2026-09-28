"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/auth/actions";
import { cn } from "@/lib/utils";
import {
  initialSignOutFormState,
  type SignOutFormState,
} from "@/lib/auth-form-state";

type SignOutFormProps = {
  ariaLabel?: string;
  buttonClassName?: string;
  label?: string;
};

export function SignOutForm({
  ariaLabel,
  buttonClassName,
  label = "Sign out",
}: SignOutFormProps) {
  const [state, formAction, isPending] = useActionState<
    SignOutFormState,
    FormData
  >(signOut, initialSignOutFormState);

  return (
    <form action={formAction} className="grid gap-3">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        aria-label={ariaLabel}
        className={cn(buttonClassName)}
        disabled={isPending}
        type="submit"
        variant="outline"
      >
        {isPending ? "Signing out…" : label}
      </Button>
    </form>
  );
}
