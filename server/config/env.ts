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

const positiveSafeInteger = z
  .string()
  .regex(/^\d+$/, "must be a positive whole number")
  .transform(Number)
  .refine(Number.isSafeInteger, "must be a safe integer")
  .refine((value) => value > 0, "must be greater than zero");

const storageBucketName = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
    "must be a valid Supabase Storage bucket name"
  );

const serverEnvironmentSchema = z.object({
  DATABASE_URL: postgresConnectionString,
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_EMBEDDING_MODEL: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
  DOCUMENTS_BUCKET: storageBucketName,
  DOCUMENT_STORAGE_QUOTA_BYTES: positiveSafeInteger,
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
