import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

let vercelMiddlewareModulePromise;

async function vercelMiddlewareModule() {
  if (!vercelMiddlewareModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/vercel-middleware"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    vercelMiddlewareModulePromise = import(
      "../packages/vercel-middleware/dist/index.js"
    );
  }

  return vercelMiddlewareModulePromise;
}

function response(status, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

function nextRequestLike(overrides = {}) {
  return {
    method: "GET",
    url: "https://example.com/pricing?utm_source=chatgpt&token=secret",
    nextUrl: {
      hostname: "example.com",
      pathname: "/pricing",
      search: "?utm_source=chatgpt&token=secret",
    },
    headers: new Headers({
      "user-agent": "GPTBot/1.3",
      referer: "https://chatgpt.com/share/example",
      "x-forwarded-for": "203.0.113.42, 198.51.100.4",
      "x-vercel-id": "iad1::iad1::promptscout-test",
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "VA",
    }),
    ...overrides,
  };
}

describe("Vercel middleware collector", () => {
  it("sends setup probes to the probe endpoint without AI classification", async () => {
    const { trackPromptScoutAiTraffic } = await vercelMiddlewareModule();
    const waitUntilPromises = [];
    const calls = [];

    const result = trackPromptScoutAiTraffic(
      nextRequestLike({
        url: "https://example.com/__promptscout/setup-probe",
        nextUrl: {
          hostname: "example.com",
          pathname: "/__promptscout/setup-probe",
          search: "",
        },
        headers: new Headers({
          "user-agent": "PromptScout-Setup-Probe/1.0",
          "x-promptscout-setup-probe": "1",
          "x-promptscout-probe-id": "probe_123",
          "x-promptscout-probe-token": "probe-token-123",
          "x-vercel-id": "iad1::iad1::probe",
        }),
      }),
      {
        waitUntil(promise) {
          waitUntilPromises.push(promise);
        },
      },
      {
        endpoint: "https://promptscout.example/ingest/live-ai-traffic",
        probeEndpoint:
          "https://promptscout.example/ingest/live-ai-traffic/probe",
        ingestToken: "test-token",
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(202);
        },
        now: () => new Date("2026-05-31T10:00:00.000Z"),
      },
    );

    assert.deepEqual(result, { mode: "waitUntil", tracked: true, probe: true });
    await waitUntilPromises[0];

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://promptscout.example/ingest/live-ai-traffic/probe",
    );
    assert.equal(calls[0].init.headers.authorization, "Bearer test-token");

    const body = JSON.parse(calls[0].init.body);
    assert.equal(Object.hasOwn(body, "events"), false);
    assert.deepEqual(body.probe, {
      schemaVersion: 1,
      eventKind: "setup_probe",
      sourceProvider: "vercel",
      observedAt: "2026-05-31T10:00:00.000Z",
      probe: {
        id: "probe_123",
        token: "probe-token-123",
      },
      request: {
        host: "example.com",
        path: "/__promptscout/setup-probe",
        method: "GET",
        userAgent: "PromptScout-Setup-Probe/1.0",
      },
      integration: {
        kind: "vercel_nextjs_middleware",
        name: "vercel-middleware",
        requestId: "iad1::iad1::probe",
      },
    });
  });

  it("normalizes representative NextRequest-like objects with core classification and privacy", async () => {
    const { buildPromptScoutVercelAiTrafficEvent } =
      await vercelMiddlewareModule();

    const event = await buildPromptScoutVercelAiTrafficEvent(
      nextRequestLike(),
      {
        now: () => new Date("2026-05-26T10:00:00.000Z"),
        privacy: {
          query: { mode: "allowlist", allow: ["utm_source"] },
          ip: {
            mode: "hash",
            salt: "site_123:test-token",
            keyId: "site_123",
            truncatedBits: 64,
          },
        },
      },
    );

    assert.deepEqual(event.request, {
      host: "example.com",
      path: "/pricing",
      search: "?utm_source=chatgpt",
      method: "GET",
      userAgent: "GPTBot/1.3",
      referer: "https://chatgpt.com/share/example",
    });
    assert.deepEqual(event.providerClassification, {
      provider: "openai_gptbot",
      agentType: "ai_training_crawler",
      confidence: 0.98,
      matchedBy: ["user_agent"],
    });
    assert.deepEqual(event.location, {
      country: "US",
      region: "VA",
    });
    assert.equal(event.sourceProvider, "vercel");
    assert.equal(event.integration.kind, "vercel_nextjs_middleware");
    assert.equal(event.integration.name, "vercel-middleware");
    assert.equal(event.integration.requestId, "iad1::iad1::promptscout-test");
    assert.equal(event.ipHash.algorithm, "hmac-sha256");
    assert.equal(event.ipHash.value.length, 16);
    assert.equal(event.ipHash.originalIpRetention, "discarded_after_hash");
  });

  it("uses waitUntil for mocked ingest without requiring detection rules in customer code", async () => {
    const { trackPromptScoutAiTraffic } = await vercelMiddlewareModule();
    const waitUntilPromises = [];
    const calls = [];

    const result = trackPromptScoutAiTraffic(
      nextRequestLike(),
      {
        waitUntil(promise) {
          waitUntilPromises.push(promise);
        },
      },
      {
        endpoint: "https://promptscout.example/ingest/live-ai-traffic",
        ingestToken: "test-token",
        siteId: "site_123",
        now: () => new Date("2026-05-26T10:05:00.000Z"),
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(202);
        },
        privacy: {
          query: { mode: "omit" },
          ip: { mode: "disabled" },
        },
      },
    );

    assert.deepEqual(result, { mode: "waitUntil", tracked: true });
    assert.equal(waitUntilPromises.length, 1);
    await waitUntilPromises[0];

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://promptscout.example/ingest/live-ai-traffic",
    );
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.authorization, "Bearer test-token");
    assert.equal(calls[0].init.headers["x-promptscout-site-id"], "site_123");

    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.events.length, 1);
    assert.equal(
      body.events[0].providerClassification.provider,
      "openai_gptbot",
    );
    assert.equal(body.events[0].request.search, undefined);
    assert.deepEqual(body.events[0].ipHash, {
      algorithm: "none",
      originalIpRetention: "not_collected",
    });
  });

  it("tracks UTM-only ChatGPT referral visits with safe query attribution", async () => {
    const { trackPromptScoutAiTraffic } = await vercelMiddlewareModule();
    const waitUntilPromises = [];
    const calls = [];

    const result = trackPromptScoutAiTraffic(
      nextRequestLike({
        url: "https://example.com/pricing?utm_source=chatgpt.com&prompt=private",
        nextUrl: {
          hostname: "example.com",
          pathname: "/pricing",
          search: "?utm_source=chatgpt.com&prompt=private",
        },
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
          "x-vercel-id": "iad1::iad1::utm-only",
        }),
      }),
      {
        waitUntil(promise) {
          waitUntilPromises.push(promise);
        },
      },
      {
        endpoint: "https://promptscout.example/ingest/live-ai-traffic",
        ingestToken: "test-token",
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(202);
        },
        privacy: {
          query: { mode: "omit" },
          ip: { mode: "disabled" },
        },
      },
    );

    assert.deepEqual(result, { mode: "waitUntil", tracked: true });
    assert.equal(waitUntilPromises.length, 1);
    await waitUntilPromises[0];

    const event = JSON.parse(calls[0].init.body).events[0];
    assert.deepEqual(event.providerClassification, {
      provider: "openai_chatgpt_referral",
      agentType: "ai_referral_visit",
      confidence: 0.68,
      matchedBy: ["query"],
    });
    assert.equal(event.request.search, "?utm_source=chatgpt.com");
    assert.equal(calls[0].init.body.includes("utm_source"), true);
    assert.equal(calls[0].init.body.includes("prompt=private"), false);
  });

  it("skips unknown traffic by default", async () => {
    const { trackPromptScoutAiTraffic } = await vercelMiddlewareModule();
    const waitUntilPromises = [];
    const calls = [];

    const result = trackPromptScoutAiTraffic(
      nextRequestLike({
        url: "https://example.com/pricing",
        nextUrl: {
          hostname: "example.com",
          pathname: "/pricing",
          search: "",
        },
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
          referer: "https://example.org/",
        }),
      }),
      {
        waitUntil(promise) {
          waitUntilPromises.push(promise);
        },
      },
      {
        endpoint: "https://promptscout.example/ingest/live-ai-traffic",
        ingestToken: "test-token",
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(202);
        },
      },
    );

    assert.deepEqual(result, {
      mode: "skipped",
      tracked: false,
      reason: "unknown_classification",
    });
    assert.equal(waitUntilPromises.length, 0);
    assert.equal(calls.length, 0);
  });
});
