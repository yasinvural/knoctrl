"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/auth/actions";
import {
  initialSignOutFormState,
  type SignOutFormState,
} from "@/server/auth/credentials";

export function SignOutForm() {
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
      <Button disabled={isPending} type="submit" variant="outline">
        {isPending ? "Signing out…" : "Sign out"}
      </Button>
    </form>
  );
}
