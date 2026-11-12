import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "../../.local/evidence/playwright-results",
  reporter: [
    ["list"],
    ["junit", { outputFile: "../../.local/evidence/e2e-junit.xml" }],
    [
      "html",
      { outputFolder: "../../.local/evidence/playwright-report", open: "never" },
    ],
  ],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:18104",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 960 } },
    },
  ],
});
