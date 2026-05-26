import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

let coreModulePromise;

async function coreModule() {
  if (!coreModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/core"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    coreModulePromise = import("../packages/core/dist/index.js");
  }

  return coreModulePromise;
}

describe("AI traffic classifier", () => {
  it("classifies fixture-backed known AI bot and fetcher user agents", async () => {
    const { classifyUserAgent } = await coreModule();
    const cases = JSON.parse(
      await readFile(
        "packages/core/fixtures/classifier/known-user-agents.json",
        "utf8",
      ),
    );

    for (const {
      userAgent,
      provider,
      agentType,
      matchedRule,
      docsUrl,
    } of cases) {
      const result = classifyUserAgent(userAgent);

      assert.equal(result.provider, provider);
      assert.equal(result.agentType, agentType);
      assert.equal(result.matchedRule, matchedRule);
      assert.deepEqual(result.matchedBy, ["user_agent"]);
      assert.ok(result.confidence >= 0.9);
      if (docsUrl) {
        assert.equal(result.docsUrl, docsUrl);
      }
    }
  });

  it("uses explicit unknown fallbacks for missing and malformed user agents", async () => {
    const { classifyUserAgent } = await coreModule();

    for (const userAgent of [
      undefined,
      null,
      "",
      "   ",
      42,
      {},
      "Mozilla/5.0",
    ]) {
      assert.deepEqual(classifyUserAgent(userAgent), {
        provider: "other",
        agentType: "other",
        confidence: 0,
        matchedRule: "fallback:unknown-user-agent",
        matchedBy: ["other"],
      });
    }
  });

  it("classifies AI referrals without an AI bot user agent", async () => {
    const { classifyAiTraffic, classifyReferer } = await coreModule();

    assert.deepEqual(classifyReferer("https://chatgpt.com/share/abc"), {
      provider: "ai_browser_referral",
      agentType: "ai_assistant_referral",
      confidence: 0.74,
      matchedRule: "ref:openai:chatgpt",
      matchedBy: ["referer"],
      docsUrl: "https://platform.openai.com/docs/bots",
    });

    const result = classifyAiTraffic({
      userAgent: "Mozilla/5.0",
      referer: "https://www.perplexity.ai/search/example",
    });

    assert.equal(result.provider, "perplexity_referral");
    assert.equal(result.agentType, "ai_assistant_referral");
    assert.equal(result.matchedRule, "ref:perplexity");
    assert.deepEqual(result.matchedBy, ["referer"]);
  });

  it("prefers higher-confidence AI bot user-agent signals over conflicting referrals", async () => {
    const { classifyAiTraffic } = await coreModule();

    const result = classifyAiTraffic({
      headers: {
        "user-agent": "GPTBot/1.3",
        referer: "https://claude.ai/",
      },
    });

    assert.equal(result.provider, "openai_gptbot");
    assert.equal(result.agentType, "ai_training_crawler");
    assert.equal(result.matchedRule, "ua:openai:gptbot");
    assert.deepEqual(result.matchedBy, ["user_agent"]);
  });
});
