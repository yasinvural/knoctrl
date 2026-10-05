import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // PDF parsing resolves its worker relative to the installed Node package.
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/pdf-parse/dist/**/pdf.worker.mjs"],
  },
};

export default nextConfig;
