import "server-only";

export type TextChunk = {
  sequence: number;
  content: string;
  startOffset: number;
  endOffset: number;
};

const chunkSize = 1_000;
const chunkOverlap = 150;

export function normalizeDocumentText(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function createTextChunks(input: string): TextChunk[] {
  const text = normalizeDocumentText(input);

  if (!text) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let startOffset = 0;

  while (startOffset < text.length) {
    let endOffset = Math.min(startOffset + chunkSize, text.length);

    if (endOffset < text.length) {
      const boundary = text.lastIndexOf(" ", endOffset);

      if (boundary > startOffset + chunkSize / 2) {
        endOffset = boundary;
      }
    }

    const slice = text.slice(startOffset, endOffset);
    const content = slice.trim();

    if (content) {
      chunks.push({
        sequence: chunks.length,
        content,
        startOffset: startOffset + slice.length - slice.trimStart().length,
        endOffset: endOffset - (slice.length - slice.trimEnd().length),
      });
    }

    if (endOffset === text.length) {
      break;
    }

    startOffset = Math.max(endOffset - chunkOverlap, startOffset + 1);
  }

  return chunks;
}
