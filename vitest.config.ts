import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 20000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
