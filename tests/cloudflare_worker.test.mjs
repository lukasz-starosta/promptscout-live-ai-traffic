import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

const TEST_INGEST_TOKEN = "site-scoped-test-token";
const TEST_INGEST_URL = "https://promptscout.example/ingest/live-ai-traffic";

let cloudflareWorkerModulePromise;

async function cloudflareWorkerModule() {
  if (!cloudflareWorkerModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/cloudflare-worker"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    cloudflareWorkerModulePromise = import(
      "../packages/cloudflare-worker/dist/index.js"
    );
  }

  return cloudflareWorkerModulePromise;
}

function env(overrides = {}) {
  return {
    PROMPTSCOUT_INGEST_TOKEN: TEST_INGEST_TOKEN,
    PROMPTSCOUT_INGEST_URL: TEST_INGEST_URL,
    ...overrides,
  };
}

describe("cloudflare worker collector", () => {
  it("sends setup probes to the probe endpoint without AI classification", async () => {
    const { observeCloudflareWorkerRequest } = await cloudflareWorkerModule();
    const ingestCalls = [];
    const request = new Request(
      "https://example.com/__promptscout/setup-probe",
      {
        headers: {
          "user-agent": "PromptScout-Setup-Probe/1.0",
          "x-promptscout-setup-probe": "1",
          "x-promptscout-probe-id": "probe_123",
          "x-promptscout-probe-token": "probe-token-123",
          "cf-ray": "probe-ray-WAW",
        },
      },
    );

    await observeCloudflareWorkerRequest(
      request,
      env({
        PROMPTSCOUT_PROBE_URL:
          "https://promptscout.example/ingest/live-ai-traffic/probe",
      }),
      {
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          return new Response("", { status: 202 });
        },
        now: () => new Date("2026-05-31T10:00:00.000Z"),
      },
    );

    assert.equal(ingestCalls.length, 1);
    assert.equal(
      ingestCalls[0].url,
      "https://promptscout.example/ingest/live-ai-traffic/probe",
    );

    const body = JSON.parse(ingestCalls[0].init.body);
    assert.equal(Object.hasOwn(body, "events"), false);
    assert.equal(body.probe.eventKind, "setup_probe");
    assert.equal(body.probe.probe.id, "probe_123");
    assert.equal(Object.hasOwn(body.probe, "providerClassification"), false);
    assert.equal(body.probe.integration.requestId, "probe-ray-WAW");
  });

  it("forwards the original request while scheduling ingest with waitUntil", async () => {
    const { handlePromptScoutCloudflareWorkerRequest } =
      await cloudflareWorkerModule();
    const originRequests = [];
    const ingestCalls = [];
    const waitUntilPromises = [];
    let resolveIngest;
    const ingestGate = new Promise((resolve) => {
      resolveIngest = resolve;
    });
    const request = new Request(
      "https://example.com/guides/live-ai-traffic?utm_source=chatgpt&plan=pro",
      {
        headers: {
          "user-agent": "OAI-SearchBot/1.0",
          referer: "https://chatgpt.com/share/example",
          "cf-ray": "abc123-WAW",
          "cf-connecting-ip": "203.0.113.42",
        },
      },
    );

    const response = await handlePromptScoutCloudflareWorkerRequest(
      request,
      env(),
      { waitUntil: (promise) => waitUntilPromises.push(promise) },
      {
        originFetch: async (forwardedRequest) => {
          originRequests.push(forwardedRequest);
          return new Response("origin response", { status: 203 });
        },
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          await ingestGate;
          return new Response("", { status: 202 });
        },
      },
    );

    assert.equal(response.status, 203);
    assert.equal(await response.text(), "origin response");
    assert.equal(originRequests.length, 1);
    assert.equal(originRequests[0], request);
    assert.equal(waitUntilPromises.length, 1);
    assert.equal(ingestCalls.length, 1);

    resolveIngest();
    await waitUntilPromises[0];

    assert.equal(ingestCalls.length, 1);
    assert.equal(ingestCalls[0].url, TEST_INGEST_URL);
    assert.equal(
      ingestCalls[0].init.headers.authorization,
      `Bearer ${TEST_INGEST_TOKEN}`,
    );
    assert.equal(
      Object.hasOwn(ingestCalls[0].init.headers, "x-promptscout-site-id"),
      false,
    );

    const body = JSON.parse(ingestCalls[0].init.body);
    assert.equal(body.events.length, 1);
    assert.deepEqual(body.events[0], {
      schemaVersion: 1,
      eventKind: "request_observation",
      sourceProvider: "cloudflare",
      observedAt: body.events[0].observedAt,
      request: {
        host: "example.com",
        path: "/guides/live-ai-traffic",
        method: "GET",
        userAgent: "OAI-SearchBot/1.0",
        referer: "https://chatgpt.com/share/example",
      },
      providerClassification: {
        provider: "openai_search_bot",
        agentType: "ai_search_crawler",
        confidence: 0.99,
        matchedBy: ["user_agent"],
      },
      ipHash: {
        algorithm: "none",
        originalIpRetention: "not_collected",
      },
      integration: {
        kind: "cloudflare_worker",
        name: "cloudflare-worker",
        requestId: "abc123-WAW",
      },
    });
    assert.match(body.events[0].observedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal("search" in body.events[0].request, false);
    assert.equal(JSON.stringify(body).includes("utm_source=chatgpt"), false);
    assert.equal(JSON.stringify(body).includes("203.0.113.42"), false);
  });

  it("keeps query strings only when explicitly configured", async () => {
    const { observeCloudflareWorkerRequest } = await cloudflareWorkerModule();
    const ingestCalls = [];
    const request = new Request(
      "https://example.com/guides/live-ai-traffic?utm_source=chatgpt&plan=pro",
      {
        headers: { "user-agent": "OAI-SearchBot/1.0" },
      },
    );

    await observeCloudflareWorkerRequest(
      request,
      env({ PROMPTSCOUT_QUERY_POLICY: "keep" }),
      {
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          return new Response("", { status: 202 });
        },
      },
    );

    const event = JSON.parse(ingestCalls[0].init.body).events[0];
    assert.equal(event.request.search, "?utm_source=chatgpt&plan=pro");
  });

  it("applies path and query privacy bindings before ingest", async () => {
    const { observeCloudflareWorkerRequest } = await cloudflareWorkerModule();
    const ingestCalls = [];
    const request = new Request(
      "https://example.com/accounts/123?plan=pro&token=secret&utm=chatgpt",
      {
        method: "POST",
        headers: {
          "user-agent": "PerplexityBot/1.0",
          referer: "https://perplexity.ai/search/example",
        },
      },
    );

    await observeCloudflareWorkerRequest(
      request,
      env({
        PROMPTSCOUT_PATH_POLICY: "redact",
        PROMPTSCOUT_QUERY_ALLOWLIST: "plan",
      }),
      {
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          return new Response("", { status: 202 });
        },
      },
    );

    const event = JSON.parse(ingestCalls[0].init.body).events[0];
    assert.equal(event.request.path, "/_promptscout/redacted");
    assert.equal(event.request.search, "?plan=pro");
    assert.equal(JSON.stringify(event).includes("token=secret"), false);
  });

  it("falls back to background delivery when waitUntil is unavailable", async () => {
    const { handlePromptScoutCloudflareWorkerRequest } =
      await cloudflareWorkerModule();
    const ingestCalls = [];

    const response = await handlePromptScoutCloudflareWorkerRequest(
      new Request("https://example.com/pricing", {
        headers: { "user-agent": "ClaudeBot/1.0" },
      }),
      env(),
      {},
      {
        originFetch: async () => new Response("ok"),
        ingestFetch: async (url, init) => {
          ingestCalls.push({ url, init });
          return new Response("", { status: 202 });
        },
      },
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(ingestCalls.length, 1);
  });
});
