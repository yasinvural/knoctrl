import { describe, expect, it, vi } from "vitest";

const openAIConstructor = vi.hoisted(() => vi.fn());
const inngestConstructor = vi.hoisted(() => vi.fn());
const documentBucket = vi.hoisted(() => vi.fn());
const createServiceRoleClient = vi.hoisted(() =>
  vi.fn(() => ({ storage: { from: documentBucket } }))
);

vi.mock("openai", () => ({ default: openAIConstructor }));
vi.mock("inngest", () => ({ Inngest: inngestConstructor }));
vi.mock("@/server/integrations/supabase/service-role-client", () => ({
  createSupabaseServiceRoleClient: createServiceRoleClient,
}));

import { createInngestClient } from "@/server/integrations/inngest/client";
import { createOpenAIClient } from "@/server/integrations/openai/client";
import { createDocumentStorage } from "@/server/integrations/supabase/document-storage";

describe("document provider adapters", () => {
  it("creates an OpenAI client with the supplied server-only key", () => {
    createOpenAIClient({ OPENAI_API_KEY: "openai-test-key" });

    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: "openai-test-key",
    });
  });

  it("creates an Inngest client with the supplied event key", () => {
    createInngestClient({ INNGEST_EVENT_KEY: "inngest-event-test-key" });

    expect(inngestConstructor).toHaveBeenCalledWith({
      id: "knoctrl",
      eventKey: "inngest-event-test-key",
      signingKey: "inngest-signing-test-key",
    });
  });

  it("returns the configured private Storage bucket", () => {
    createDocumentStorage({ DOCUMENTS_BUCKET: "documents" });

    expect(createServiceRoleClient).toHaveBeenCalledOnce();
    expect(documentBucket).toHaveBeenCalledWith("documents");
  });
});
