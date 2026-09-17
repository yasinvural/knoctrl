import "server-only";

import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/server/integrations/supabase/server-client";

export async function createSupabaseServerActionClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });
}
