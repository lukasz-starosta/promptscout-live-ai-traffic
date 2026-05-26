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

    for (const fixture of cases) {
      const {
        name,
        userAgent,
        provider,
        agentType,
        matchedRule,
        docsUrl,
        confidenceLabel,
        signalSource,
        sourceUrl,
      } = fixture;
      const result = classifyUserAgent(userAgent);

      assert.ok(name, "fixture must have a stable name");
      assert.ok(sourceUrl, `${name}: fixture must cite a signal source URL`);
      assert.equal(
        confidenceLabel,
        "high",
        `${name}: documented user-agent rules must be high confidence`,
      );
      assert.equal(signalSource, "user_agent", `${name}: signal source`);
      assert.equal(result.provider, provider, `${name}: provider`);
      assert.equal(result.agentType, agentType, `${name}: agentType`);
      assert.equal(result.matchedRule, matchedRule, `${name}: matchedRule`);
      assert.deepEqual(result.matchedBy, ["user_agent"], `${name}: matchedBy`);
      assert.ok(result.confidence >= 0.9, `${name}: confidence`);
      if (docsUrl) {
        assert.equal(result.docsUrl, docsUrl, `${name}: docsUrl`);
      }
    }
  });

  it("classifies named AI assistant referral fixtures as advisory signals", async () => {
    const { classifyReferer } = await coreModule();
    const cases = JSON.parse(
      await readFile(
        "packages/core/fixtures/classifier/known-referrers.json",
        "utf8",
      ),
    );

    for (const fixture of cases) {
      const {
        name,
        referer,
        provider,
        agentType,
        matchedRule,
        docsUrl,
        confidenceLabel,
        signalSource,
        sourceUrl,
      } = fixture;
      const result = classifyReferer(referer);

      assert.ok(name, "fixture must have a stable name");
      assert.ok(sourceUrl, `${name}: fixture must cite a signal source URL`);
      assert.equal(confidenceLabel, "advisory", `${name}: confidence label`);
      assert.equal(signalSource, "referer", `${name}: signal source`);
      assert.equal(result.provider, provider, `${name}: provider`);
      assert.equal(result.agentType, agentType, `${name}: agentType`);
      assert.equal(result.matchedRule, matchedRule, `${name}: matchedRule`);
      assert.deepEqual(result.matchedBy, ["referer"], `${name}: matchedBy`);
      assert.ok(result.confidence < 0.9, `${name}: confidence`);
      if (docsUrl) {
        assert.equal(result.docsUrl, docsUrl, `${name}: docsUrl`);
      }
    }
  });

  it("documents request-level evidence and crawler source links", async () => {
    const evidence = await readFile("docs/evidence.md", "utf8");

    assert.match(
      evidence,
      /JavaScript pixels are not complete AI crawler tracking/i,
    );
    assert.match(evidence, /https:\/\/platform\.openai\.com\/docs\/bots/);
    assert.match(
      evidence,
      /https:\/\/vercel\.com\/blog\/the-rise-of-the-ai-crawler/,
    );
    assert.match(evidence, /https:\/\/vercel\.com\/i\/how-ai-is-changing-seo/);
    assert.match(evidence, /High-confidence signals/i);
    assert.match(evidence, /Weak or advisory signals/i);
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

  it("falls back to populated header values when direct fields are blank", async () => {
    const { classifyAiTraffic } = await coreModule();

    assert.equal(
      classifyAiTraffic({
        userAgent: "",
        headers: { "user-agent": "GPTBot/1.3" },
      }).matchedRule,
      "ua:openai:gptbot",
    );

    assert.equal(
      classifyAiTraffic({
        referer: "   ",
        referrer: "https://www.perplexity.ai/search/example",
      }).matchedRule,
      "ref:perplexity",
    );
  });
});
