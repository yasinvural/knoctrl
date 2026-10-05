import { describe, expect, it } from "vitest";

import {
  createTextChunks,
  normalizeDocumentText,
} from "@/server/documents/chunking";

describe("document chunking", () => {
  it("normalizes line endings and whitespace", () => {
    expect(normalizeDocumentText("  Alpha\r\nBeta\t Gamma  ")).toBe(
      "Alpha\nBeta Gamma"
    );
  });

  it("creates ordered chunks with source offsets", () => {
    const chunks = createTextChunks("word ".repeat(300));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({ sequence: 0, startOffset: 0 });
    expect(chunks[1]?.sequence).toBe(1);
    expect(chunks[1]?.startOffset).toBeLessThan(chunks[0]?.endOffset ?? 0);
  });
});
