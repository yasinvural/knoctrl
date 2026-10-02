import Link from "next/link";

import { DocumentList, type DocumentDisplayItem } from "./document-list";
import { DocumentUploadForm } from "./document-upload-form";

type DocumentSectionProps = {
  workspaceId: string;
  folderId?: string;
  destinationName: string;
  documents: DocumentDisplayItem[];
  documentCount: number;
  page: number;
};

export function DocumentSection({ workspaceId, folderId, destinationName, documents, documentCount, page }: DocumentSectionProps) {
  const pageCount = Math.max(1, Math.ceil(documentCount / 50));
  function pageHref(target: number) {
    const search = new URLSearchParams({ documentPage: String(target) });
    if (folderId) search.set("documentFolder", folderId);
    return `/app/workspaces/${workspaceId}?${search}#documents-${folderId ?? "root"}`;
  }
  return (
    <section aria-label={`Documents in ${destinationName}`} className="grid min-w-0 gap-4" id={`documents-${folderId ?? "root"}`}>
      <DocumentUploadForm destinationName={destinationName} folderId={folderId} workspaceId={workspaceId} />
      <DocumentList documents={documents.map(({ id, filename, status, failureMessage }) => ({ id, filename, status, failureMessage }))} />
      {pageCount > 1 ? <nav aria-label={`Document pages in ${destinationName}`} className="flex flex-wrap items-center gap-3 text-sm">
        {page > 1 ? <Link className="underline underline-offset-4" href={pageHref(page - 1)}>Previous</Link> : null}
        <span>Page {page} of {pageCount} · {documentCount} documents</span>
        {page < pageCount ? <Link className="underline underline-offset-4" href={pageHref(page + 1)}>Next</Link> : null}
      </nav> : null}
    </section>
  );
}
