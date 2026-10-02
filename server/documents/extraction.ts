import "server-only";

import { parse } from "csv-parse/sync";
import mammoth from "mammoth";

import { normalizeDocumentText } from "./chunking";

export class DocumentExtractionError extends Error {}

async function extractText(
  content: Buffer,
  filename: string
): Promise<string> {
  const extension = filename.split(".").pop()?.toLowerCase();
  let text: string;

  if (extension === "txt") {
    text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } else if (extension === "csv") {
    text = parse(content, { bom: true, relax_column_count: true, skip_empty_lines: true })
      .filter((row: string[]) => row.some((cell) => cell.trim()))
      .map((row: string[]) => row.join(" | "))
      .join("\n");
  } else if (extension === "docx") {
    text = (await mammoth.extractRawText({ buffer: content })).value;
  } else if (extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: content });

    try {
      // Canonical page labels preserve page provenance without parser-specific objects.
      text = (await parser.getText()).pages
        .filter((page) => /[\p{L}\p{N}]/u.test(page.text))
        .map((page) => `[Page ${page.num}]\n${page.text}`)
        .join("\n\n");
    } finally {
      await parser.destroy();
    }
  } else {
    throw new DocumentExtractionError("Unsupported document type.");
  }

  const normalized = normalizeDocumentText(text);

  if (!normalized || !/[\p{L}\p{N}]/u.test(normalized)) {
    throw new DocumentExtractionError("The document has no extractable text.");
  }

  return normalized;
}

export async function extractDocumentText(content: Buffer, filename: string): Promise<string> {
  try {
    return await extractText(content, filename);
  } catch {
    // Provider errors can contain document contents, filenames, or object paths.
    throw new DocumentExtractionError("The file could not be read or has no usable text.");
  }
}
