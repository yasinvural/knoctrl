"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";

import { DeleteResourceDialog } from "@/components/workspaces/delete-resource-dialog";
import { Button } from "@/components/ui/button";
import { initialDocumentFormState } from "@/lib/document-form-state";
import { cn } from "@/lib/utils";
import { deleteDocumentAction, retryDocumentAction } from "@/server/documents/actions";

export type DocumentDisplayItem = {
  id: string;
  filename: string;
  status: "processing" | "available" | "failed";
  failureMessage: string | null;
};

function DocumentRow({ document }: { document: DocumentDisplayItem }) {
  const [state, retryAction, pending] = useActionState(retryDocumentAction, initialDocumentFormState);
  return (
    <li className="grid min-w-0 gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-all text-sm font-medium">{document.filename}</p>
        <span className={cn("rounded-full bg-muted px-2 py-1 text-xs font-medium",
          document.status === "failed" && "bg-destructive/10 text-destructive")}>
          {({ processing: "Processing", available: "Available", failed: "Failed" })[document.status]}
        </span>
      </div>
      {document.status === "failed" ? <p className="text-sm text-muted-foreground">
        {document.failureMessage ?? "We couldn't process this file. Try again."}
      </p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {document.status === "failed" ? <form action={retryAction}>
          <input name="documentId" type="hidden" value={document.id} />
          <Button aria-label={`Retry processing ${document.filename}`} disabled={pending} size="icon" type="submit" variant="outline">
            <RotateCcw aria-hidden="true" className={cn(pending && "motion-safe:animate-spin")} />
          </Button>
        </form> : null}
        <DeleteResourceDialog action={deleteDocumentAction}
          description={`Deleting ${document.filename} permanently removes this document and its stored source file.`}
          hiddenFields={{ documentId: document.id }} title={`Delete ${document.filename}?`}
          triggerAccessibleLabel={`Delete ${document.filename}`} triggerLabel="Delete document" />
      </div>
      {state.status === "error" ? <p className="text-sm text-destructive" role="alert">{state.formError}</p> : null}
    </li>
  );
}

export function DocumentList({ documents }: { documents: DocumentDisplayItem[] }) {
  if (!documents.length) return <p className="text-sm text-muted-foreground">No documents yet. Upload files to add sources here.</p>;
  return <ul aria-label="Documents" className="grid gap-3">{documents.map((document) => <DocumentRow document={document} key={document.id} />)}</ul>;
}
