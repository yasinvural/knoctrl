/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(), request: vi.fn(), upload: vi.fn(), complete: vi.fn(),
  cancel: vi.fn(), retry: vi.fn(), delete: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/document-upload", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/document-upload")>();
  return { ...original, requestDocumentUploads: mocks.request, uploadDocumentFile: mocks.upload, completeUploadedDocument: mocks.complete };
});
vi.mock("@/server/documents/actions", () => ({
  cancelDocumentUploadAction: mocks.cancel, retryDocumentAction: mocks.retry, deleteDocumentAction: mocks.delete,
}));

import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DocumentUploadError } from "@/lib/document-upload";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const folderId = "00000000-0000-4000-8000-000000000002";
const documentId = "00000000-0000-4000-8000-000000000003";
const textFile = () => new File(["hello"], "notes.txt", { type: "text/plain" });

describe("document management components", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.request.mockResolvedValue({ uploads: [{ documentId, filename: "notes.txt", signedUrl: "https://storage.example.test/upload" }], rejectedFiles: [] });
    mocks.upload.mockResolvedValue(undefined);
    mocks.complete.mockResolvedValue(undefined);
    mocks.cancel.mockResolvedValue({ status: "success" });
    mocks.retry.mockResolvedValue({ status: "success" });
    mocks.delete.mockResolvedValue({ status: "success" });
  });
  afterEach(cleanup);

  it("uploads valid files to the chosen folder and reports rejected files independently", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<DocumentUploadForm destinationName="Research" folderId={folderId} workspaceId={workspaceId} />);
    await user.upload(screen.getByLabelText("Upload to Research"), [textFile(), new File(["bad"], "image.png", { type: "image/png" })]);
    expect(screen.getByText("Only DOCX, CSV, PDF, and TXT files are supported.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Upload selected files" }));
    expect(await screen.findByText("Uploaded — processing")).toBeVisible();
    expect(mocks.request).toHaveBeenCalledWith(workspaceId, folderId, [{ filename: "notes.txt", contentType: "text/plain", fileSize: 5 }]);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledWith(documentId);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
  });

  it("rejects more than ten files before contacting the upload endpoint", async () => {
    const user = userEvent.setup();
    render(<DocumentUploadForm destinationName="workspace root" workspaceId={workspaceId} />);
    await user.upload(screen.getByLabelText("Upload to workspace root"), Array.from({ length: 11 }, (_, index) => new File(["x"], `${index}.txt`, { type: "text/plain" })));
    expect(screen.getByText("Upload no more than 10 files at a time.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload selected files" })).toBeDisabled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("shows byte progress and prevents changing files while a transfer is running", async () => {
    let finish: (() => void) | undefined;
    mocks.upload.mockImplementation((_url: string, _file: File, _type: string, progress: (value: number) => void) => {
      progress(40);
      return new Promise<void>((resolve) => { finish = resolve; });
    });
    const user = userEvent.setup();
    render(<DocumentUploadForm destinationName="workspace root" workspaceId={workspaceId} />);
    const input = screen.getByLabelText("Upload to workspace root");
    await user.upload(input, textFile());
    await user.click(screen.getByRole("button", { name: "Upload selected files" }));
    expect(await screen.findByRole("progressbar", { name: "Upload progress for notes.txt" })).toHaveAttribute("value", "40");
    expect(input).toBeDisabled();
    expect(mocks.complete).not.toHaveBeenCalled();
    if (!finish) throw new Error("Missing pending transfer");
    finish();
    await screen.findByText("Uploaded — processing");
  });

  it("reports quota and duplicate errors safely", async () => {
    mocks.request.mockRejectedValue(new DocumentUploadError("These files exceed your remaining 100 MB storage quota."));
    const user = userEvent.setup();
    render(<DocumentUploadForm destinationName="workspace root" workspaceId={workspaceId} />);
    await user.upload(screen.getByLabelText("Upload to workspace root"), textFile());
    await user.click(screen.getByRole("button", { name: "Upload selected files" }));
    expect(await screen.findByText("These files exceed your remaining 100 MB storage quota.")).toBeVisible();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("accepts dropped files and fills a missing browser MIME type from a supported extension", async () => {
    render(<DocumentUploadForm destinationName="workspace root" workspaceId={workspaceId} />);
    const input = screen.getByLabelText("Upload to workspace root");
    fireEvent.drop(input.closest("form")!, { dataTransfer: { files: [new File(["hello"], "notes.txt")] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
    await screen.findByText("Uploaded — processing");
    expect(mocks.request).toHaveBeenCalledWith(workspaceId, undefined, [{ filename: "notes.txt", fileSize: 5, contentType: "text/plain" }]);
  });

  it("releases an incomplete reservation after a transfer failure", async () => {
    mocks.upload.mockRejectedValue(new Error("secret provider details"));
    const user = userEvent.setup();
    render(<DocumentUploadForm destinationName="workspace root" workspaceId={workspaceId} />);
    await user.upload(screen.getByLabelText("Upload to workspace root"), textFile());
    await user.click(screen.getByRole("button", { name: "Upload selected files" }));
    await screen.findByText("The file could not be uploaded. Select it again to retry.");
    expect(mocks.cancel).toHaveBeenCalledWith(documentId);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.queryByText("secret provider details")).not.toBeInTheDocument();
  });

  it("retries completion using the saved file without a second upload", async () => {
    mocks.complete.mockRejectedValueOnce(new Error("dispatch unavailable")).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<DocumentUploadForm destinationName="workspace root" workspaceId={workspaceId} />);
    await user.upload(screen.getByLabelText("Upload to workspace root"), textFile());
    await user.click(screen.getByRole("button", { name: "Upload selected files" }));
    await user.click(await screen.findByRole("button", { name: "Finish upload" }));
    await screen.findByText("Uploaded — processing");
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });

  it("shows all statuses and exposes retry only for failed documents", async () => {
    const user = userEvent.setup();
    render(<DocumentList documents={[
      { id: documentId, filename: "failed.txt", status: "failed", failureMessage: "Couldn't read this file." },
      { id: "available", filename: "available.txt", status: "available", failureMessage: null },
      { id: "processing", filename: "processing.txt", status: "processing", failureMessage: null },
    ]} />);
    expect(screen.getByText("Available")).toBeVisible();
    expect(screen.getByText("Processing")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Retry processing/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Retry processing failed.txt" }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalled());
    expect(mocks.retry.mock.calls[0][1].get("documentId")).toBe(documentId);
  });

  it("cancels document deletion with keyboard and returns focus to its trigger", async () => {
    const user = userEvent.setup();
    render(<DocumentList documents={[{ id: documentId, filename: "notes.txt", status: "available", failureMessage: null }]} />);
    const trigger = screen.getByRole("button", { name: "Delete notes.txt" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/permanently removes this document and its stored source file/)).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});
