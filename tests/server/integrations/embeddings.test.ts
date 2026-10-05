import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/server/integrations/openai/client", () => ({
  createOpenAIClient: () => ({ embeddings: { create } }),
}));

import { embedTexts } from "@/server/integrations/openai/embeddings";

describe("embedding adapter", () => {
  beforeEach(() => vi.resetAllMocks());

  it("batches inputs and restores vector ordering", async () => {
    create.mockImplementation(async ({ input }: { input: string[] }) => ({
      data: input.map((_, index) => ({ index, embedding: Array(1536).fill(index) })).reverse(),
    }));
    const vectors = await embedTexts(Array.from({ length: 33 }, (_, index) => `chunk ${index}`));
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toMatchObject({ dimensions: 1536, encoding_format: "float" });
    expect(create.mock.calls[0][0].input).toHaveLength(32);
    expect(create.mock.calls[1][0].input).toHaveLength(1);
    expect(vectors).toHaveLength(33);
    expect(vectors[31][0]).toBe(31);
  });

  it.each([
    [],
    [{ index: 0, embedding: [0.1] }],
    [{ index: 1, embedding: Array(1536).fill(0.1) }],
    [{ index: 0, embedding: Array(1536).fill(NaN) }],
  ])("rejects missing, mismatched, or invalid vectors", async (...data) => {
    create.mockResolvedValue({ data });
    await expect(embedTexts(["chunk"])).rejects.toThrow("Embedding response is invalid.");
  });

  it("does not call the provider for an empty chunk set", async () => {
    await expect(embedTexts([])).resolves.toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
