import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      // keeper/ is generated from the keeper package, whose own tests cover it; wallet/ is
      // connector wiring, exercised in the browser.
      exclude: ["src/lib/abi/**", "src/lib/**/*.test.ts", "src/lib/protocol/keeper/**", "src/lib/wallet/**"],
      reporter: ["text", "html"],
    },
  },
});
