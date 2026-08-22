import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./tests/cloudflare-runtime/wrangler.jsonc",
      },
    }),
  ],
  test: {
    include: ["tests/cloudflare-runtime/**/*.test.ts"],
    setupFiles: ["./tests/cloudflare-runtime/setup.ts"],
  },
});
