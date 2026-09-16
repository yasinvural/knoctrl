import "server-only";

import type { CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/server/integrations/supabase/server-client";

type SessionClient = {
  auth: {
    getClaims: () => Promise<unknown>;
  };
};

type SessionClientFactory = (
  cookieMethods: CookieMethodsServer
) => SessionClient;

export async function refreshSupabaseSession(
  request: NextRequest,
  createSessionClient: SessionClientFactory = createSupabaseServerClient
) {
  let response = NextResponse.next({ request });
  const supabase = createSessionClient({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => {
        request.cookies.set(name, value);
      });

      response = NextResponse.next({ request });

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  });

  await supabase.auth.getClaims();

  return response;
}
