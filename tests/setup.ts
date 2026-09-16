import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL ??=
  "postgresql://postgres:password@localhost:5432/knoctrl";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "publishable-test-key";
process.env.SUPABASE_SECRET_KEY ??= "service-role-test-key";
