import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { DeleteResourceDialog } from "@/components/workspaces/delete-resource-dialog";
import { ResourceNameForm } from "@/components/workspaces/resource-name-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/current-user";
import {
  createFolderAction,
  deleteFolderAction,
  deleteWorkspaceAction,
  renameFolderAction,
  renameWorkspaceAction,
} from "@/server/workspaces/actions";
import { getWorkspaceDetail } from "@/server/workspaces/workspace-service";

const workspaceIdSchema = z.string().uuid();

type WorkspaceDetailPageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceDetailPage({
  params,
}: WorkspaceDetailPageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser.status === "unauthenticated") {
    redirect("/sign-in");
  }

  const { workspaceId } = await params;
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!parsedWorkspaceId.success) {
    notFound();
  }

  const workspace = await getWorkspaceDetail(
    currentUser.user.id,
    parsedWorkspaceId.data
  );

  if (!workspace) {
    notFound();
  }

  const folderCountDescription = `${workspace.folders.length} ${
    workspace.folders.length === 1 ? "folder" : "folders"
  } and 0 documents`;

  return (
    <main className="flex flex-1 bg-muted/40">
      <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6">
        <div className="space-y-3">
          <Link
            className="inline-flex text-sm font-medium underline underline-offset-4"
            href="/app"
          >
            Back to workspaces
          </Link>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {workspace.name}
            </h1>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section aria-labelledby="folders-heading" className="space-y-4">
            <div>
              <h2 className="text-lg font-medium" id="folders-heading">
                Folders
              </h2>
              <p className="text-sm text-muted-foreground">
                Organize documents within this workspace.
              </p>
            </div>
            {workspace.folders.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No folders yet</CardTitle>
                  <CardDescription>
                    Folders are optional. Documents can also belong directly to this workspace.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {workspace.folders.map((folder) => (
                  <Card key={folder.id}>
                    <CardHeader>
                      <CardTitle>{folder.name}</CardTitle>
                      <CardDescription>No documents yet.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <ResourceNameForm
                        action={renameFolderAction}
                        hiddenFields={{
                          folderId: folder.id,
                          workspaceId: workspace.id,
                        }}
                        initialName={folder.name}
                        inputId={`folder-${folder.id}-name`}
                        label="Folder name"
                        submitLabel="Rename folder"
                      />
                      <DeleteResourceDialog
                        action={deleteFolderAction}
                        description={`Deleting this folder permanently removes it and its 0 documents.`}
                        hiddenFields={{
                          folderId: folder.id,
                          workspaceId: workspace.id,
                        }}
                        title={`Delete ${folder.name}?`}
                        triggerLabel="Delete folder"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
          <aside className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Create a folder</CardTitle>
                <CardDescription>
                  Use one-level folders to organize related documents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResourceNameForm
                  action={createFolderAction}
                  hiddenFields={{ workspaceId: workspace.id }}
                  inputId="new-folder-name"
                  label="Folder name"
                  resetAfterSuccess
                  submitLabel="Create folder"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Manage workspace</CardTitle>
                <CardDescription>
                  Rename or permanently delete this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <ResourceNameForm
                  action={renameWorkspaceAction}
                  hiddenFields={{ workspaceId: workspace.id }}
                  initialName={workspace.name}
                  inputId="workspace-name"
                  label="Workspace name"
                  submitLabel="Rename workspace"
                />
                <DeleteResourceDialog
                  action={deleteWorkspaceAction}
                  description={`Deleting this workspace permanently removes ${folderCountDescription}.`}
                  hiddenFields={{ workspaceId: workspace.id }}
                  title={`Delete ${workspace.name}?`}
                  triggerLabel="Delete workspace"
                />
              </CardContent>
            </Card>
          </aside>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              No documents yet. Uploading documents will be available in the next capability.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
