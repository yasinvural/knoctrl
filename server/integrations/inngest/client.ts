import "server-only";

import { Inngest } from "inngest";

import type { ServerEnvironment } from "@/server/config/env";
import { serverEnvironment } from "@/server/config/env";

export function createInngestClient(
  environment: Pick<ServerEnvironment, "INNGEST_EVENT_KEY"> & Partial<Pick<ServerEnvironment, "INNGEST_SIGNING_KEY">> = serverEnvironment
) {
  return new Inngest({
    id: "knoctrl",
    eventKey: environment.INNGEST_EVENT_KEY,
    signingKey: environment.INNGEST_SIGNING_KEY ?? serverEnvironment.INNGEST_SIGNING_KEY,
  });
}
