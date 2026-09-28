import Link from "next/link";

import { SignOutForm } from "@/components/auth/sign-out-form";

type AuthenticatedHeaderProps = {
  email: string;
};

export function AuthenticatedHeader({ email }: AuthenticatedHeaderProps) {
  const initial = email.slice(0, 1).toUpperCase() || "A";

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link className="font-heading text-base font-medium" href="/app">
          KnowledgeControl
        </Link>
        <SignOutForm
          ariaLabel={`Sign out ${email}`}
          buttonClassName="size-9 rounded-full p-0"
          label={initial}
        />
      </div>
    </header>
  );
}
