import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function WorkspaceNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <section className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace unavailable
        </h1>
        <p className="text-muted-foreground">
          This workspace may have been deleted or is not available to your account.
        </p>
        <Link className={buttonVariants()} href="/app">
          Return to workspaces
        </Link>
      </section>
    </main>
  );
}
