import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "mobile.spec.ts", workers: 1, timeout: 45000,
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 568 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
  ],
  use: { baseURL: "http://127.0.0.1:3108", channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true, isMobile: true, hasTouch: true, deviceScaleFactor: 2, trace: "retain-on-failure" },
  reporter: "list", outputDir: "../work/mobile-results",
  webServer: { command: "node e2e/helpers/project-management-server.mjs", cwd: "..", url: "http://127.0.0.1:3108", timeout: 120000, reuseExistingServer: false },
});
