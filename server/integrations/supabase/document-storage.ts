import "server-only";

import type { ServerEnvironment } from "@/server/config/env";
import { serverEnvironment } from "@/server/config/env";

import { createSupabaseServiceRoleClient } from "./service-role-client";

export function createDocumentStorage(
  environment: Pick<ServerEnvironment, "DOCUMENTS_BUCKET"> = serverEnvironment,
  createClient = createSupabaseServiceRoleClient
) {
  return createClient().storage.from(environment.DOCUMENTS_BUCKET);
}
