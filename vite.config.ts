import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths so the built site works from a GitHub Pages project URL.
  base: "./",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
