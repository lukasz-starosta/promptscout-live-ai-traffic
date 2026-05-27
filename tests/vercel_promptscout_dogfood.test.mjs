import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Vercel PromptScout dogfood smoke", () => {
  it("captures the real-ingest setup, evidence, and Vercel limitations", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const script = await readFile(
      "examples/vercel-nextjs/dogfood-promptscout.mjs",
      "utf8",
    );
    const docs = await readFile("docs/dogfood-vercel-promptscout.md", "utf8");

    assert.match(packageJson.scripts["dogfood:vercel"], /dogfood-promptscout/);

    for (const userAgent of ["ChatGPT-User", "OAI-SearchBot", "GPTBot"]) {
      assert.match(script, new RegExp(userAgent));
      assert.match(docs, new RegExp(userAgent));
    }

    for (const provider of [
      "openai_chatgpt_user",
      "openai_search_bot",
      "openai_gptbot",
    ]) {
      assert.match(script, new RegExp(provider));
      assert.match(docs, new RegExp(provider));
    }

    for (const requiredText of [
      "PROMPTSCOUT_INGEST_URL",
      "PROMPTSCOUT_INGEST_TOKEN",
      "PROMPTSCOUT_DOGFOOD_DEBUG_URL",
      "source_id",
      "live_ai_traffic_sources",
      "sourceProvider",
      "vercel",
      "Vercel Hobby",
      "Vercel Pro",
      "matcher",
      "proxy",
    ]) {
      assert.match(docs, new RegExp(requiredText));
    }
  });
});
