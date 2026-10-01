import "server-only";

import OpenAI from "openai";

import type { ServerEnvironment } from "@/server/config/env";
import { serverEnvironment } from "@/server/config/env";

export function createOpenAIClient(
  environment: Pick<ServerEnvironment, "OPENAI_API_KEY"> = serverEnvironment
) {
  return new OpenAI({ apiKey: environment.OPENAI_API_KEY });
}
