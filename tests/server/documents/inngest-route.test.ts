import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/inngest/events", async () => {
  const { Inngest } = await import("inngest");
  return { inngest: new Inngest({
    id: "signature-test", isDev: false,
    signingKey: `signkey-prod-${"a".repeat(64)}`,
  }) };
});
vi.mock("@/server/inngest/functions", () => ({ documentFunctions: [] }));

import { POST } from "@/app/api/inngest/route";

describe("Inngest production webhook verification", () => {
  it.each([undefined, "t=1&s=invalid"])("rejects absent or invalid signatures", async (signature) => {
    const response = await POST(new NextRequest("https://example.test/api/inngest?fnId=signature-test-process-document", {
      method: "POST", body: JSON.stringify({ event: { name: "documents/process.requested", data: {} } }),
      headers: signature ? { "x-inngest-signature": signature } : {},
    }), {});
    expect(response.status).toBe(401);
  });
});
