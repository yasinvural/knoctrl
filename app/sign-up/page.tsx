import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { register } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function SignUpPage() {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "authenticated") {
    redirect("/app");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <AuthForm
        action={register}
        alternativeHref="/sign-in"
        alternativeLabel="Sign in"
        alternativeText="Already have an account?"
        submitLabel="Create account"
        title="Create your account"
      />
    </main>
  );
}
