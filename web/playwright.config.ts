import { defineConfig } from "@playwright/test";

// E2E runs against a production build in mock mode, using the system Chrome (no browser download).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", channel: "chrome", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
    env: { NEXT_PUBLIC_USE_MOCKS: "true" },
  },
});
