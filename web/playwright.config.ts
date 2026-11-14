import { defineConfig } from "@playwright/test";

// E2E runs against a LOCAL stack, in the system Chrome (no browser download):
//   1. API:  cd api && python dev.py          (in-memory store, rules mode, no keys) -> http://localhost:8000
//   2. Web:  cd web && npx next build && npx next start -p 3100
//   3. Test: cd web && npm run test:e2e
// Override the address with WEB_URL. Each test makes its own demo copy, so tests do not affect each other.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.WEB_URL ?? "http://localhost:3100", channel: "chrome", trace: "retain-on-failure" },
});
