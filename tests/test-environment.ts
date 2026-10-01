export const testEnvironment = {
  DATABASE_URL: "postgresql://postgres:password@localhost:5432/knoctrl",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "service-role-test-key",
  OPENAI_API_KEY: "openai-test-key",
  OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
  INNGEST_EVENT_KEY: "inngest-event-test-key",
  INNGEST_SIGNING_KEY: "inngest-signing-test-key",
  DOCUMENTS_BUCKET: "documents",
  DOCUMENT_STORAGE_QUOTA_BYTES: "104857600",
};

export function getAuthenticationE2EEnvironment() {
  if (process.env.AUTH_E2E_ENABLED !== "true") {
    return testEnvironment;
  }

  const variables = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "OPENAI_API_KEY",
    "OPENAI_EMBEDDING_MODEL",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "DOCUMENTS_BUCKET",
    "DOCUMENT_STORAGE_QUOTA_BYTES",
  ] as const;
  const missingVariables = variables.filter(
    (name) => !process.env[`AUTH_E2E_${name}`]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Authentication E2E configuration is missing: ${missingVariables
        .map((name) => `AUTH_E2E_${name}`)
        .join(", ")}`
    );
  }

  const getEnvironmentVariable = (name: (typeof variables)[number]) => {
    const value = process.env[`AUTH_E2E_${name}`];

    if (!value) {
      throw new Error(
        `Authentication E2E configuration is missing: AUTH_E2E_${name}`
      );
    }

    return value;
  };

  return {
    DATABASE_URL: getEnvironmentVariable("DATABASE_URL"),
    NEXT_PUBLIC_SUPABASE_URL: getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: getEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    ),
    SUPABASE_SECRET_KEY: getEnvironmentVariable("SUPABASE_SECRET_KEY"),
  };
}
