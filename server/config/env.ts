import "server-only";

import { z } from "zod";

const postgresConnectionString = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "must be a PostgreSQL connection string"
  );

const serverEnvironmentSchema = z.object({
  DATABASE_URL: postgresConnectionString,
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(environment);

  if (result.success) {
    return result.data;
  }

  const invalidVariables = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter((path, index, paths) => paths.indexOf(path) === index);

  throw new Error(
    `Server environment configuration is invalid: ${invalidVariables.join(
      ", "
    )}. Check .env.example for required variables.`
  );
}

export const serverEnvironment = parseServerEnvironment(process.env);
