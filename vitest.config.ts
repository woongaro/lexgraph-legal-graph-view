import { defineConfig } from "vitest/config";

export default defineConfig({
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
