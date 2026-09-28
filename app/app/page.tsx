import { redirect } from "next/navigation";

import Link from "next/link";

import { CreateWorkspaceForm } from "@/components/workspaces/create-workspace-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/current-user";
import { listWorkspaces } from "@/server/workspaces/workspace-service";

type ApplicationPageProps = {
  searchParams: Promise<{ cursor?: string }>;
};

export default async function ApplicationPage({
  searchParams,
}: ApplicationPageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    redirect("/sign-in");
  }

  const { cursor } = await searchParams;
  const workspaceList = await listWorkspaces(currentUser.user.id, cursor);

  return (
    <main className="flex flex-1 bg-muted/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="workspace-heading" className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Your knowledge
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight" id="workspace-heading">
              Workspaces
            </h1>
          </div>
          {workspaceList.workspaces.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No workspaces yet</CardTitle>
                <CardDescription>
                  Create a workspace to keep knowledge for each project or collection separate.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {workspaceList.workspaces.map((workspace) => (
                <Link href={`/app/workspaces/${workspace.id}`} key={workspace.id}>
                  <Card className="h-full transition-colors hover:bg-muted/60">
                    <CardHeader>
                      <CardTitle>{workspace.name}</CardTitle>
                      <CardDescription>
                        View folders and documents in this workspace.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {workspaceList.nextCursor ? (
            <Link
              className="inline-flex text-sm font-medium underline underline-offset-4"
              href={`/app?cursor=${workspaceList.nextCursor}`}
            >
              Show more workspaces
            </Link>
          ) : null}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Create a workspace</CardTitle>
            <CardDescription>
              Workspaces keep documents for separate projects organized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateWorkspaceForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
