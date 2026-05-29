import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

const TEST_INGEST_TOKEN = ["site-scoped", "netlify", "fixture"].join("-");
const TEST_INGEST_URL = "https://promptscout.example/ingest/live-ai-traffic";

let netlifyEdgeModulePromise;

async function netlifyEdgeModule() {
  if (!netlifyEdgeModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/netlify-edge"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    netlifyEdgeModulePromise = import("../packages/netlify-edge/dist/index.js");
  }

  return netlifyEdgeModulePromise;
}

function env(overrides = {}) {
  return {
    PROMPTSCOUT_INGEST_TOKEN: TEST_INGEST_TOKEN,
    PROMPTSCOUT_INGEST_URL: TEST_INGEST_URL,
    ...overrides,
  };
}

describe("Netlify Edge collector", () => {
  it("preserves request flow through context.next while scheduling ingest with waitUntil", async () => {
    const { handlePromptScoutNetlifyEdgeRequest } = await netlifyEdgeModule();
    const ingestCalls = [];
    const waitUntilPromises = [];
    let nextCalls = 0;
    let resolveIngest;
    const ingestGate = new Promise((resolve) => {
      resolveIngest = resolve;
    });
    const request = new Request(
      "https://example.com/guides/live-ai-traffic?utm_source=chatgpt&plan=pro",
      {
        headers: {
          "user-agent": "ChatGPT-User/1.0",
          referer: "https://chatgpt.com/share/example",
        },
      },
    );
    const context = {
      ip: "203.0.113.42",
      requestId: "netlify-edge-request-001",
      geo: {
        country: { code: "US" },
        subdivision: { code: "CA" },
      },
      next: async () => {
        nextCalls += 1;
        return new Response("origin response", { status: 203 });
      },
      waitUntil: (promise) => waitUntilPromises.push(promise),
    };

    const response = await handlePromptScoutNetlifyEdgeRequest(
      request,
      context,
      {
        env: env(),
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          await ingestGate;
          return new Response("", { status: 202 });
        },
        now: () => new Date("2026-05-26T10:00:00.000Z"),
      },
    );

    assert.equal(response.status, 203);
    assert.equal(await response.text(), "origin response");
    assert.equal(nextCalls, 1);
    assert.equal(waitUntilPromises.length, 1);
    assert.equal(ingestCalls.length, 1);

    resolveIngest();
    await waitUntilPromises[0];

    assert.equal(ingestCalls[0].url, TEST_INGEST_URL);
    assert.equal(
      ingestCalls[0].init.headers.authorization,
      `Bearer ${TEST_INGEST_TOKEN}`,
    );

    const body = JSON.parse(ingestCalls[0].init.body);
    assert.equal(body.events.length, 1);
    assert.deepEqual(body.events[0], {
      schemaVersion: 1,
      eventKind: "request_observation",
      sourceProvider: "netlify",
      observedAt: "2026-05-26T10:00:00.000Z",
      request: {
        host: "example.com",
        path: "/guides/live-ai-traffic",
        method: "GET",
        userAgent: "ChatGPT-User/1.0",
        referer: "https://chatgpt.com/share/example",
      },
      providerClassification: {
        provider: "openai_chatgpt_user",
        agentType: "ai_browser_user",
        confidence: 0.96,
        matchedBy: ["user_agent"],
      },
      location: {
        country: "US",
        region: "CA",
      },
      ipHash: {
        algorithm: "none",
        originalIpRetention: "not_collected",
      },
      integration: {
        kind: "netlify_edge",
        name: "netlify-edge",
        requestId: "netlify-edge-request-001",
      },
    });
    assert.equal("search" in body.events[0].request, false);
    assert.equal(JSON.stringify(body).includes("utm_source=chatgpt"), false);
    assert.equal(JSON.stringify(body).includes("203.0.113.42"), false);
  });

  it("falls back to background delivery when context.waitUntil is unavailable", async () => {
    const { handlePromptScoutNetlifyEdgeRequest } = await netlifyEdgeModule();
    const ingestCalls = [];
    let nextCalls = 0;

    const response = await handlePromptScoutNetlifyEdgeRequest(
      new Request("https://example.com/pricing", {
        headers: { "user-agent": "PerplexityBot/1.0" },
      }),
      {
        next: async () => {
          nextCalls += 1;
          return new Response("ok");
        },
      },
      {
        env: env(),
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          return new Response("", { status: 202 });
        },
      },
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
    assert.equal(nextCalls, 1);

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(ingestCalls.length, 1);
  });

  it("continues the Netlify request chain when collector configuration is unavailable", async () => {
    const { handlePromptScoutNetlifyEdgeRequest } = await netlifyEdgeModule();
    let nextCalls = 0;

    const response = await handlePromptScoutNetlifyEdgeRequest(
      new Request("https://example.com/docs", {
        headers: { "user-agent": "GPTBot/1.0" },
      }),
      {
        next: async () => {
          nextCalls += 1;
          return new Response("origin still served", { status: 200 });
        },
      },
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "origin still served");
    assert.equal(nextCalls, 1);
  });
});
