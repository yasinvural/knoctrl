import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function Home() {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "authenticated") {
    redirect("/app");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <section className="max-w-xl space-y-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          KnowledgeControl
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Answers grounded in your documents.
        </h1>
        <p className="text-lg text-muted-foreground">
          Create a private account to organize knowledge and return to your
          conversations.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link className={buttonVariants()} href="/sign-up">
            Create an account
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/sign-in"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
