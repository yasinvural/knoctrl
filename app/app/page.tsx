import { redirect } from "next/navigation";

import { SignOutForm } from "@/components/auth/sign-out-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function ApplicationPage() {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    redirect("/sign-in");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re signed in</CardTitle>
          <CardDescription>
            Your private KnowledgeControl workspace will appear here next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutForm />
        </CardContent>
      </Card>
    </main>
  );
}
