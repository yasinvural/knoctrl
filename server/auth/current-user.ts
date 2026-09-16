import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/server/integrations/supabase/server-client";

type UserLookup<UserType> = {
  getUser: () => Promise<{
    data: { user: UserType | null };
    error: unknown;
  }>;
};

export type CurrentUserResult<UserType> =
  | { status: "authenticated"; user: UserType }
  | { status: "unauthenticated" };

export async function resolveCurrentUser<UserType>(
  auth: UserLookup<UserType>
): Promise<CurrentUserResult<UserType>> {
  const { data, error } = await auth.getUser();

  if (error || !data.user) {
    return { status: "unauthenticated" };
  }

  return { status: "authenticated", user: data.user };
}

export async function getCurrentUser(): Promise<CurrentUserResult<User>> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll();
    },
  });

  return resolveCurrentUser(supabase.auth);
}
