import "server-only";

import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";

import { serverEnvironment } from "@/server/config/env";

export function createSupabaseServerClient(cookieMethods: CookieMethodsServer) {
  return createServerClient(
    serverEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: cookieMethods,
    },
  );
}
