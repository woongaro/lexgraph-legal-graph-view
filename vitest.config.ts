import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "src/test-support/obsidian.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
    exclude: ["node_modules"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/legal/**"],
    },
  },
});
