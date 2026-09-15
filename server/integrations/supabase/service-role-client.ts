import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnvironment } from "@/server/config/env";

export function createSupabaseServiceRoleClient() {
  return createClient(
    serverEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
