import "server-only";

import type {
  DocumentUploadMetadata,
  DocumentUploadValidation,
  RejectedDocumentUpload,
  ValidatedDocumentUpload,
} from "./types";

export const maximumDocumentsPerUpload = 10;
export const maximumDocumentSizeBytes = 10 * 1024 * 1024;

const supportedContentTypes = new Map([
  ["pdf", new Set(["application/pdf"])],
  [
    "docx",
    new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
  ],
  ["csv", new Set(["text/csv", "application/vnd.ms-excel"])],
  ["txt", new Set(["text/plain"])],
]);

function getFilename(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  return input.length > 0 && input.length <= 255 ? input : null;
}

function rejectedFile(
  filename: string | null,
  code: RejectedDocumentUpload["code"],
  fieldError: string
): RejectedDocumentUpload {
  return { filename, code, fieldError };
}

function validateFile(input: DocumentUploadMetadata):
  | { status: "accepted"; file: ValidatedDocumentUpload }
  | { status: "rejected"; file: RejectedDocumentUpload } {
  const filename = getFilename(input.filename);

  if (!filename || /[\\/\u0000-\u001F]/.test(filename)) {
    return {
      status: "rejected",
      file: rejectedFile(filename, "invalid_filename", "Enter a valid filename."),
    };
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  const contentType = typeof input.contentType === "string" ? input.contentType : "";

  if (!extension || !supportedContentTypes.get(extension)?.has(contentType)) {
    return {
      status: "rejected",
      file: rejectedFile(
        filename,
        "unsupported_type",
        "Only DOCX, CSV, PDF, and TXT files are supported."
      ),
    };
  }

  if (
    typeof input.fileSize !== "number" ||
    !Number.isSafeInteger(input.fileSize) ||
    input.fileSize < 0
  ) {
    return {
      status: "rejected",
      file: rejectedFile(filename, "invalid_filename", "This file has an invalid size."),
    };
  }

  if (input.fileSize > maximumDocumentSizeBytes) {
    return {
      status: "rejected",
      file: rejectedFile(
        filename,
        "file_too_large",
        "Each file must be 10 MB or smaller."
      ),
    };
  }

  return {
    status: "accepted",
    file: {
      filename,
      contentType,
      fileSize: input.fileSize,
    },
  };
}

export function validateDocumentUploadBatch(
  files: readonly DocumentUploadMetadata[]
): DocumentUploadValidation {
  if (files.length === 0) {
    return {
      status: "rejected",
      acceptedFiles: [],
      rejectedFiles: [],
      formError: "Select at least one file to upload.",
    };
  }

  if (files.length > maximumDocumentsPerUpload) {
    return {
      status: "rejected",
      acceptedFiles: [],
      rejectedFiles: [],
      formError: "Upload no more than 10 files at a time.",
    };
  }

  const acceptedFiles: ValidatedDocumentUpload[] = [];
  const rejectedFiles: RejectedDocumentUpload[] = [];

  for (const input of files) {
    const result = validateFile(input);

    if (result.status === "accepted") {
      acceptedFiles.push(result.file);
    } else {
      rejectedFiles.push(result.file);
    }
  }

  const duplicateNames = new Set(
    acceptedFiles
      .filter(
        (file, index, accepted) =>
          accepted.findIndex((candidate) => candidate.filename === file.filename) !== index
      )
      .map((file) => file.filename)
  );

  if (duplicateNames.size > 0) {
    const uniqueAcceptedFiles = acceptedFiles.filter(
      (file) => !duplicateNames.has(file.filename)
    );

    for (const filename of duplicateNames) {
      const duplicateCount = acceptedFiles.filter(
        (file) => file.filename === filename
      ).length;

      rejectedFiles.push(
        ...Array.from({ length: duplicateCount }, () =>
          rejectedFile(
            filename,
            "duplicate_filename",
            "This filename appears more than once in the selected files."
          )
        )
      );
    }

    if (uniqueAcceptedFiles.length === 0) {
      return {
        status: "rejected",
        acceptedFiles: [],
        rejectedFiles,
        formError: "Resolve the duplicate filenames before uploading.",
      };
    }

    return {
      status: "partial",
      acceptedFiles: uniqueAcceptedFiles,
      rejectedFiles,
    };
  }

  return {
    status: rejectedFiles.length > 0 ? "partial" : "accepted",
    acceptedFiles,
    rejectedFiles,
  };
}
