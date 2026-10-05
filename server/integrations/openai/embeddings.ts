import "server-only";

import { serverEnvironment } from "@/server/config/env";

import { createOpenAIClient } from "./client";

export const embeddingDimensions = 1536;
const embeddingBatchSize = 32;

export async function embedTexts(texts: readonly string[]): Promise<number[][]> {
  const client = createOpenAIClient();
  const vectors: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += embeddingBatchSize) {
    const input = texts.slice(offset, offset + embeddingBatchSize);
    const response = await client.embeddings.create({
      model: serverEnvironment.OPENAI_EMBEDDING_MODEL,
      dimensions: embeddingDimensions,
      encoding_format: "float",
      input,
    });
    const batch = [...response.data].sort((a, b) => a.index - b.index);
    if (batch.length !== input.length || batch.some((item, index) =>
      item.index !== index || item.embedding.length !== embeddingDimensions ||
      item.embedding.some((value) => !Number.isFinite(value))
    )) throw new Error("Embedding response is invalid.");
    vectors.push(...batch.map((item) => item.embedding));
  }
  return vectors;
}
