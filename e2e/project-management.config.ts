import { defineConfig } from "@playwright/test";

// node node_modules/@playwright/test/cli.js test -c e2e/project-management.config.ts
export default defineConfig({
  testDir: ".",
  testMatch: "project-management.spec.ts",
  projects: [{ name: "project-management" }],
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3108",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  reporter: "list",
  outputDir: "../work/project-management-results",
  webServer: {
    command: "node e2e/helpers/project-management-server.mjs",
    cwd: "..",
    url: "http://127.0.0.1:3108",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
