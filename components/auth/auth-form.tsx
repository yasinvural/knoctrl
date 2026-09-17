"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAuthFormState, type AuthFormState } from "@/lib/auth-form-state";

type AuthenticationAction = (
  previousState: AuthFormState,
  formData: FormData
) => Promise<AuthFormState>;

type AuthFormProps = {
  action: AuthenticationAction;
  alternativeHref: string;
  alternativeLabel: string;
  alternativeText: string;
  submitLabel: string;
  title: string;
};

export function AuthForm({
  action,
  alternativeHref,
  alternativeLabel,
  alternativeText,
  submitLabel,
  title,
}: AuthFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialAuthFormState
  );
  const emailError = state.status === "error" ? state.fieldErrors?.email?.[0] : undefined;
  const passwordError =
    state.status === "error" ? state.fieldErrors?.password?.[0] : undefined;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="font-heading text-base leading-snug font-medium">
          {title}
        </h1>
        <CardDescription>
          Use your email address and password to access KnowledgeControl.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          {state.status === "error" && state.formError ? (
            <Alert variant="destructive">
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              aria-describedby={emailError ? "email-error" : undefined}
              aria-invalid={Boolean(emailError)}
              autoComplete="email"
              defaultValue={state.status === "error" ? state.email : ""}
              id="email"
              name="email"
              required
              type="email"
            />
            {emailError ? (
              <p className="text-sm text-destructive" id="email-error">
                {emailError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              aria-describedby={passwordError ? "password-error" : undefined}
              aria-invalid={Boolean(passwordError)}
              autoComplete="current-password"
              id="password"
              name="password"
              required
              type="password"
            />
            {passwordError ? (
              <p className="text-sm text-destructive" id="password-error">
                {passwordError}
              </p>
            ) : null}
          </div>
          <Button disabled={isPending} type="submit">
            {isPending ? "Please wait…" : submitLabel}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted-foreground">
          {alternativeText}{" "}
          <Link className="font-medium text-foreground underline" href={alternativeHref}>
            {alternativeLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
