export const testEnvironment = {
  DATABASE_URL: "postgresql://postgres:password@localhost:5432/knoctrl",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "service-role-test-key",
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
