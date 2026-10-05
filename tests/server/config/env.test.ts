import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "@/server/config/env";

const validEnvironment = {
  DATABASE_URL: "postgresql://postgres:password@localhost:5432/knoctrl",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "service-role-test-key",
  OPENAI_API_KEY: "openai-test-key",
  OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
  INNGEST_EVENT_KEY: "inngest-event-test-key",
  INNGEST_SIGNING_KEY: "inngest-signing-test-key",
  DOCUMENTS_BUCKET: "documents",
  DOCUMENT_STORAGE_QUOTA_BYTES: "104857600",
};

describe("parseServerEnvironment", () => {
  it("returns validated server configuration", () => {
    expect(parseServerEnvironment(validEnvironment)).toEqual({
      ...validEnvironment,
      DOCUMENT_STORAGE_QUOTA_BYTES: 104857600,
    });
  });

  it("reports missing variables without exposing their values", () => {
    const secret = "secret-that-must-not-appear-in-errors";

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        SUPABASE_SECRET_KEY: undefined,
      })
    ).toThrow("SUPABASE_SECRET_KEY");

    try {
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: secret,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("rejects malformed document configuration without exposing its values", () => {
    const secret = "document-secret-that-must-not-appear-in-errors";

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DOCUMENT_STORAGE_QUOTA_BYTES: "0",
      })
    ).toThrow("DOCUMENT_STORAGE_QUOTA_BYTES");

    try {
      parseServerEnvironment({
        ...validEnvironment,
        OPENAI_API_KEY: secret,
        DOCUMENTS_BUCKET: "Invalid bucket name",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("DOCUMENTS_BUCKET");
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
