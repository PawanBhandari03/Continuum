import { defineConfig } from "@playwright/test";

// Judge-style run against the LIVE deployed site (no local server). Usage:
//   LIVE_URL=https://continuum-web-kodb.onrender.com LIVE_API=https://continuum-api-945j.onrender.com \
//   npx playwright test -c playwright.live.config.ts
// It acts on the shared demo handover (approve/publish), then resets it via the API's demo reset.
export default defineConfig({
  testDir: "./tests/live",
  timeout: 15 * 60_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { channel: "chrome", baseURL: process.env.LIVE_URL ?? "https://continuum-web-kodb.onrender.com" },
});
