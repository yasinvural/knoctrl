import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function SignInPage() {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "authenticated") {
    redirect("/app");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <AuthForm
        action={signIn}
        alternativeHref="/sign-up"
        alternativeLabel="Create an account"
        alternativeText="New to KnowledgeControl?"
        submitLabel="Sign in"
        title="Welcome back"
      />
    </main>
  );
}
