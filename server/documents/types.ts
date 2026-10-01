import type { DocumentStatus } from "@/server/db/generated/client";

export type DocumentListItem = {
  id: string;
  filename: string;
  folderId: string | null;
  status: DocumentStatus;
  failureMessage: string | null;
  createdAt: Date;
};

export type DocumentUploadMetadata = {
  filename: unknown;
  contentType: unknown;
  fileSize: unknown;
};

export type ValidatedDocumentUpload = {
  filename: string;
  contentType: string;
  fileSize: number;
};

export type RejectedDocumentUpload = {
  filename: string | null;
  code: "invalid_filename" | "unsupported_type" | "file_too_large" | "duplicate_filename";
  fieldError: string;
};

export type DocumentUploadValidation =
  | {
      status: "accepted" | "partial";
      acceptedFiles: ValidatedDocumentUpload[];
      rejectedFiles: RejectedDocumentUpload[];
    }
  | {
      status: "rejected";
      acceptedFiles: [];
      rejectedFiles: RejectedDocumentUpload[];
      formError: string;
    };

export type DocumentReservation = {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  storageKey: string;
  processingAttempt: number;
};

export type DocumentReservationResult =
  | {
      status: "success";
      documents: DocumentReservation[];
      rejectedFiles: RejectedDocumentUpload[];
    }
  | { status: "invalid"; formError: string; rejectedFiles: RejectedDocumentUpload[] }
  | { status: "duplicate"; formError: string; rejectedFiles: RejectedDocumentUpload[] }
  | { status: "quota"; formError: string; rejectedFiles: RejectedDocumentUpload[] }
  | { status: "unavailable"; formError: string }
  | { status: "error"; formError: string };

export type DocumentRetryResult =
  | { status: "success"; processingAttempt: number }
  | { status: "unavailable" }
  | { status: "invalid_state" }
  | { status: "conflict" }
  | { status: "error" };

export type DocumentDeletionResult =
  | { status: "success" }
  | { status: "unavailable" }
  | { status: "error" };
