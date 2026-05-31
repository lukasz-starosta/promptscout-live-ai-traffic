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
  it("does not classify PromptScout setup probes as AI traffic", async () => {
    const { classifyAiTraffic } = await coreModule();

    assert.deepEqual(
      classifyAiTraffic({
        userAgent: "PromptScout-Setup-Probe/1.0",
        referer: "https://promptscout.com/setup-probe",
        search: "?promptscout_probe=probe_123",
      }),
      {
        provider: "other",
        agentType: "other",
        confidence: 0,
        matchedRule: "fallback:unknown-request",
        matchedBy: ["other"],
      },
    );
  });

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

  it("classifies named AI referral visit fixtures as advisory signals", async () => {
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
      if (matchedRule === "ref:google:search") {
        assert.equal(agentType, "search_referral", `${name}: agentType`);
      } else {
        assert.equal(agentType, "ai_referral_visit", `${name}: agentType`);
      }
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

  it("classifies landing URL query attribution fixtures as advisory AI referral visits", async () => {
    const { classifyAiTraffic } = await coreModule();
    const cases = JSON.parse(
      await readFile(
        "packages/core/fixtures/classifier/known-query-attribution.json",
        "utf8",
      ),
    );

    for (const fixture of cases) {
      const {
        name,
        landingUrl,
        provider,
        agentType,
        matchedRule,
        docsUrl,
        confidenceLabel,
        signalSource,
        sourceUrl,
      } = fixture;
      const result = classifyAiTraffic({
        userAgent: "Mozilla/5.0",
        landingUrl,
      });

      assert.ok(name, "fixture must have a stable name");
      assert.ok(sourceUrl, `${name}: fixture must cite a signal source URL`);
      assert.equal(confidenceLabel, "advisory", `${name}: confidence label`);
      assert.equal(signalSource, "query", `${name}: signal source`);
      assert.equal(result.provider, provider, `${name}: provider`);
      assert.equal(result.agentType, agentType, `${name}: agentType`);
      assert.equal(result.matchedRule, matchedRule, `${name}: matchedRule`);
      assert.deepEqual(result.matchedBy, ["query"], `${name}: matchedBy`);
      assert.ok(result.confidence < 0.9, `${name}: confidence`);
      assert.equal(result.docsUrl, docsUrl, `${name}: docsUrl`);
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
      /https:\/\/help\.openai\.com\/en\/articles\/10984597-chatgpt-generated-links/,
    );
    assert.match(
      evidence,
      /https:\/\/support\.claude\.com\/en\/articles\/10593882-sharing-and-unsharing-chats/,
    );
    assert.match(
      evidence,
      /https:\/\/support\.google\.com\/gemini\/answer\/13743730/,
    );
    assert.match(
      evidence,
      /https:\/\/vercel\.com\/blog\/the-rise-of-the-ai-crawler/,
    );
    assert.match(evidence, /https:\/\/vercel\.com\/i\/how-ai-is-changing-seo/);
    assert.match(evidence, /High-confidence signals/i);
    assert.match(evidence, /Weak or advisory signals/i);
    assert.match(evidence, /AI Referral Research Notes/i);
    assert.match(evidence, /Explicit non-goals/i);
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

  it("uses explicit unknown fallbacks for empty, unsafe, and malformed landing query values", async () => {
    const { classifyLandingQuery } = await coreModule();

    for (const queryLike of [
      undefined,
      null,
      "",
      "   ",
      42,
      {},
      "?",
      "?q=chatgpt",
      "?utm_source=%E0%A4%A",
    ]) {
      assert.deepEqual(classifyLandingQuery(queryLike), {
        provider: "other",
        agentType: "other",
        confidence: 0,
        matchedRule: "fallback:unknown-query",
        matchedBy: ["other"],
      });
    }
  });

  it("classifies AI referral visits without an AI bot user agent", async () => {
    const { classifyAiTraffic, classifyReferer } = await coreModule();

    assert.deepEqual(classifyReferer("https://chatgpt.com/share/abc"), {
      provider: "openai_chatgpt_referral",
      agentType: "ai_referral_visit",
      confidence: 0.78,
      matchedRule: "ref:openai:chatgpt",
      matchedBy: ["referer"],
      docsUrl:
        "https://help.openai.com/en/articles/10984597-chatgpt-generated-links",
    });

    const result = classifyAiTraffic({
      userAgent: "Mozilla/5.0",
      referer: "https://www.perplexity.ai/search/example",
    });

    assert.equal(result.provider, "perplexity_referral");
    assert.equal(result.agentType, "ai_referral_visit");
    assert.equal(result.matchedRule, "ref:perplexity");
    assert.deepEqual(result.matchedBy, ["referer"]);
  });

  it("classifies UTM-only ChatGPT visits without a referer header", async () => {
    const { classifyAiTraffic } = await coreModule();

    const result = classifyAiTraffic({
      userAgent: "Mozilla/5.0",
      search: "?utm_source=chatgpt.com&utm_medium=referral&prompt=private",
    });

    assert.equal(result.provider, "openai_chatgpt_referral");
    assert.equal(result.agentType, "ai_referral_visit");
    assert.equal(result.matchedRule, "query:openai:chatgpt");
    assert.deepEqual(result.matchedBy, ["query"]);
    assert.ok(result.confidence < 0.9);
  });

  it("classifies conservative Copilot and Bing chat referers as Microsoft AI referral visits", async () => {
    const { classifyReferer } = await coreModule();

    for (const referer of [
      "https://copilot.microsoft.com/chats/abc",
      "https://www.bing.com/chat?q=promptscout",
    ]) {
      const result = classifyReferer(referer);

      assert.equal(result.provider, "microsoft_copilot_referral", referer);
      assert.equal(result.agentType, "ai_referral_visit", referer);
      assert.equal(result.matchedRule, "ref:microsoft:copilot", referer);
      assert.deepEqual(result.matchedBy, ["referer"], referer);
      assert.ok(result.confidence < 0.9, referer);
    }
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

  it("prefers higher-confidence AI bot user-agent signals over conflicting query attribution", async () => {
    const { classifyAiTraffic } = await coreModule();

    const result = classifyAiTraffic({
      headers: {
        "user-agent": "ClaudeBot/1.0",
      },
      search: "?utm_source=chatgpt.com",
    });

    assert.equal(result.provider, "anthropic_claudebot");
    assert.equal(result.agentType, "ai_training_crawler");
    assert.equal(result.matchedRule, "ua:anthropic:claudebot");
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
