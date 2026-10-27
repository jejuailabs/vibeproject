import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "vote-edit.spec.ts", workers: 1, timeout: 60000,
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1100 } } },
    { name: "mobile-320", use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  use: { baseURL: "http://127.0.0.1:3108", channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true, trace: "retain-on-failure" },
  reporter: "list", outputDir: "../work/vote-edit-results",
  webServer: { command: "node e2e/helpers/project-management-server.mjs", cwd: "..", url: "http://127.0.0.1:3108", timeout: 120000, reuseExistingServer: false },
});
