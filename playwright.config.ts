import { defineConfig, devices } from "@playwright/test";

import { getAuthenticationE2EEnvironment } from "./tests/test-environment";

const port = 3002;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `next dev -p ${port}`,
    env: getAuthenticationE2EEnvironment(),
    reuseExistingServer: false,
    url: `http://127.0.0.1:${port}`,
  },
});
