import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // JSDOM interaction tests are CPU-bound; the host's default fan-out can starve
    // their event loop when coordinator workers are also running.
    maxWorkers: 4,
    clearMocks: true,
    restoreMocks: true,
  },
});
