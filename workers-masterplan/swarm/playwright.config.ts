import { defineConfig, devices } from "@playwright/test";
const configuredPort = process.env.SWARM_E2E_PORT
  ? Number.parseInt(process.env.SWARM_E2E_PORT, 10)
  : undefined;
const port = configuredPort ?? 4311;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `tsx tests/e2e/fixtureServer.ts --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
