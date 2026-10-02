"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeUploadedDocument, DocumentUploadError, requestDocumentUploads, uploadDocumentFile } from "@/lib/document-upload";
import { getDocumentContentType, validateDocumentUploadBatch } from "@/lib/document-upload-validation";
import { cancelDocumentUploadAction } from "@/server/documents/actions";

type UploadItem = {
  file: File;
  contentType: string;
  status: "ready" | "rejected" | "uploading" | "completing" | "processing" | "error";
  progress: number;
  message?: string;
  documentId?: string;
  canComplete?: boolean;
};

type DocumentUploadFormProps = {
  workspaceId: string;
  folderId?: string;
  destinationName: string;
};

export function DocumentUploadForm({ workspaceId, folderId, destinationName }: DocumentUploadFormProps) {
  const router = useRouter();
  const inputId = useId();
  const busy = useRef(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string>();

  function updateItem(index: number, update: Partial<UploadItem>) {
    setItems((current) => current.map((item, position) => position === index ? { ...item, ...update } : item));
  }

  function selectFiles(files: File[]) {
    if (busy.current) return;
    const metadata = files.map((file) => ({
      filename: file.name, fileSize: file.size,
      contentType: getDocumentContentType(file.name, file.type),
    }));
    const validation = validateDocumentUploadBatch(metadata);
    setFormError(validation.status === "rejected" ? validation.formError : undefined);
    setItems(files.map((file, index) => {
      const individual = validateDocumentUploadBatch([metadata[index]]);
      const rejected = individual.rejectedFiles[0] ?? validation.rejectedFiles.find((item) =>
        item.filename === file.name && item.code === "duplicate_filename");
      return {
        file, contentType: metadata[index].contentType, progress: 0,
        status: rejected || validation.status === "rejected" ? "rejected" : "ready",
        message: rejected?.fieldError,
      };
    }));
  }

  async function finishUpload(index: number, documentId: string) {
    updateItem(index, { status: "completing", canComplete: false, message: undefined });
    try {
      await completeUploadedDocument(documentId);
      updateItem(index, { status: "processing", progress: 100 });
    } catch {
      updateItem(index, { status: "error", canComplete: true,
        message: "Your file was uploaded, but processing could not be started. Try finishing the upload again." });
    }
  }

  async function uploadFiles() {
    if (busy.current) return;
    const ready = items.flatMap((item, index) => item.status === "ready" ? [{ item, index }] : []);
    if (!ready.length) return;
    busy.current = true;
    setIsUploading(true);
    setFormError(undefined);
    try {
      const result = await requestDocumentUploads(workspaceId, folderId, ready.map(({ item }) => ({
        filename: item.file.name, contentType: item.contentType, fileSize: item.file.size,
      })));
      await Promise.all(ready.map(async ({ item, index }) => {
        const upload = result.uploads.find((entry) => entry.filename === item.file.name);
        if (!upload) {
          updateItem(index, { status: "rejected", message: result.rejectedFiles.find((entry) => entry.filename === item.file.name)?.fieldError
            ?? "This file could not be accepted. Select it again." });
          return;
        }
        updateItem(index, { status: "uploading", documentId: upload.documentId });
        try {
          await uploadDocumentFile(upload.signedUrl, item.file, item.contentType, (progress) => updateItem(index, { progress }));
        } catch {
          const cleanup = await cancelDocumentUploadAction(upload.documentId).catch(() => ({ status: "error" }));
          updateItem(index, { status: "error", message: cleanup.status === "success"
            ? "The file could not be uploaded. Select it again to retry."
            : "The upload failed. Delete its incomplete document entry before uploading it again." });
          return;
        }
        await finishUpload(index, upload.documentId);
      }));
    } catch (error) {
      // Only the application's metadata endpoint supplies user-facing errors.
      setFormError(error instanceof DocumentUploadError
        ? error.message : "We couldn't prepare these files. Please try again.");
    } finally {
      busy.current = false;
      setIsUploading(false);
      router.refresh();
    }
  }

  async function retryCompletion(index: number, documentId: string) {
    if (busy.current) return;
    busy.current = true;
    setIsUploading(true);
    try {
      await finishUpload(index, documentId);
    } finally {
      busy.current = false;
      setIsUploading(false);
      router.refresh();
    }
  }

  return (
    <form className="grid min-w-0 gap-3" onSubmit={(event) => { event.preventDefault(); void uploadFiles(); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); selectFiles(Array.from(event.dataTransfer.files)); }}>
      <div className="grid gap-2 rounded-lg border border-dashed p-3">
        <Label htmlFor={inputId}>Upload to {destinationName}</Label>
        <Input accept=".pdf,.docx,.csv,.txt" aria-describedby={`${inputId}-help`} disabled={isUploading}
          id={inputId} multiple type="file" onChange={(event) => {
            selectFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }} />
        <p className="text-xs text-muted-foreground" id={`${inputId}-help`}>
          Choose or drop up to 10 PDF, DOCX, CSV, or TXT files. Each file must be 10 MB or smaller.
        </p>
      </div>
      {formError ? <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert> : null}
      {items.length ? <ul aria-label={`Selected files for ${destinationName}`} className="grid gap-2" aria-live="polite">
        {items.map((item, index) => <li className="min-w-0 rounded-lg border p-3 text-sm" key={`${index}-${item.file.name}`}>
          <p className="break-all font-medium">{item.file.name}</p>
          <p className={item.status === "error" || item.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>
            {item.message ?? ({ ready: "Ready to upload", rejected: "Not accepted", uploading: `Uploading ${item.progress}%`,
              completing: "Starting processing…", processing: "Uploaded — processing", error: "Upload failed" })[item.status]}
          </p>
          {item.status === "uploading" ? <progress aria-label={`Upload progress for ${item.file.name}`} className="mt-2 w-full" max={100} value={item.progress} /> : null}
          {item.canComplete && item.documentId ? <Button className="mt-2" disabled={isUploading} type="button" variant="outline"
            onClick={() => { if (item.documentId) void retryCompletion(index, item.documentId); }}>Finish upload</Button> : null}
        </li>)}
      </ul> : null}
      <Button disabled={isUploading || !items.some((item) => item.status === "ready")} type="submit" variant="outline">
        {isUploading ? "Uploading…" : "Upload selected files"}
      </Button>
    </form>
  );
}
