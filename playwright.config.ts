import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Project Pulse V2 E2E persona tests.
 *
 * Run with: npx playwright test
 * Run a single persona: npx playwright test -g "Hardcore Lifter"
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Grant camera by default; individual tests override to simulate denial
    permissions: [],
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  // Assumes the Next.js dev server is started separately, or auto-start it:
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL || "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
