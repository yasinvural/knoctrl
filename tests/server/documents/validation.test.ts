import { describe, expect, it } from "vitest";

import {
  maximumDocumentSizeBytes,
  validateDocumentUploadBatch,
} from "@/server/documents/validation";

describe("validateDocumentUploadBatch", () => {
  it("accepts valid files while reporting independent file errors", () => {
    expect(
      validateDocumentUploadBatch([
        { filename: "notes.txt", contentType: "text/plain", fileSize: 12 },
        { filename: "image.png", contentType: "image/png", fileSize: 8 },
        {
          filename: "large.pdf",
          contentType: "application/pdf",
          fileSize: maximumDocumentSizeBytes + 1,
        },
      ])
    ).toEqual({
      status: "partial",
      acceptedFiles: [
        { filename: "notes.txt", contentType: "text/plain", fileSize: 12 },
      ],
      rejectedFiles: [
        {
          filename: "image.png",
          code: "unsupported_type",
          fieldError: "Only DOCX, CSV, PDF, and TXT files are supported.",
        },
        {
          filename: "large.pdf",
          code: "file_too_large",
          fieldError: "Each file must be 10 MB or smaller.",
        },
      ],
    });
  });

  it("rejects the whole batch when its aggregate count exceeds the limit", () => {
    const file = { filename: "notes.txt", contentType: "text/plain", fileSize: 1 };

    expect(validateDocumentUploadBatch(Array.from({ length: 11 }, () => file))).toEqual({
      status: "rejected",
      acceptedFiles: [],
      rejectedFiles: [],
      formError: "Upload no more than 10 files at a time.",
    });
  });

  it("rejects every exact duplicate filename in a selection", () => {
    expect(
      validateDocumentUploadBatch([
        { filename: "notes.txt", contentType: "text/plain", fileSize: 1 },
        { filename: "notes.txt", contentType: "text/plain", fileSize: 2 },
      ])
    ).toMatchObject({
      status: "rejected",
      acceptedFiles: [],
      rejectedFiles: [
        { filename: "notes.txt", code: "duplicate_filename" },
        { filename: "notes.txt", code: "duplicate_filename" },
      ],
    });
  });
});
