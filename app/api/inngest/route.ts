import { serve } from "inngest/next";

import { documentFunctions } from "@/server/inngest/functions";
import { inngest } from "@/server/inngest/events";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: documentFunctions,
});
