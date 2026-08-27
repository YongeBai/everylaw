import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read", "clipboard-write"] } },
    { name: "mobile", testMatch: /mobile\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
});
