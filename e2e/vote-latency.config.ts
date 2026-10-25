import { defineConfig } from "@playwright/test";

// Run: node node_modules/@playwright/test/cli.js test -c e2e/vote-latency.config.ts
export default defineConfig({
  testDir: ".",
  testMatch: "vote-latency.spec.ts",
  projects: [{ name: "vote-latency" }],
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3107",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  reporter: "list",
  outputDir: "../work/vote-latency-results",
  webServer: {
    command: "node e2e/helpers/vote-latency-server.mjs",
    cwd: "..",
    url: "http://127.0.0.1:3107",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
