import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: 0,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
