import { redirect } from "next/navigation";

import { AuthenticatedHeader } from "@/components/workspaces/authenticated-header";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function ApplicationLayout({
  children,
}: LayoutProps<"/app">) {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AuthenticatedHeader email={currentUser.user.email ?? "Account"} />
      {children}
    </div>
  );
}
