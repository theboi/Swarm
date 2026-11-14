import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./client/src", import.meta.url)) }, dedupe: ["react", "react-dom", "@radix-ui/themes", "radix-ui"] },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "client/src/coordinator/**/*.test.{ts,tsx}", "tests/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // JSDOM interaction tests are CPU-bound; the host's default fan-out can starve
    // their event loop when coordinator workers are also running.
    maxWorkers: 4,
    clearMocks: true,
    restoreMocks: true,
  },
});
