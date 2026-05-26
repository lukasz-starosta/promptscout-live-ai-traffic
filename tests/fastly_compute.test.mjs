import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

let fastlyComputeModulePromise;

async function fastlyComputeModule() {
  if (!fastlyComputeModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/fastly-compute"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    fastlyComputeModulePromise = import(
      "../packages/fastly-compute/dist/index.js"
    );
  }

  return fastlyComputeModulePromise;
}

describe("Fastly Compute collector", () => {
  it("normalizes Compute requests into PromptScout live AI traffic events", async () => {
    const { normalizeFastlyComputeRequest } = await fastlyComputeModule();
    const request = new Request(
      "https://www.example.com/pricing?plan=pro&utm_source=chatgpt",
      {
        method: "GET",
        headers: {
          "user-agent": "ChatGPT-User/1.0",
          referer: "https://chatgpt.com/share/example",
        },
      },
    );

    const event = normalizeFastlyComputeRequest(request, {
      now: () => new Date("2026-05-26T10:45:00.000Z"),
      country: "US",
      region: "CA",
      requestId: "req-123",
    });

    assert.equal(event.schemaVersion, 1);
    assert.equal(event.eventKind, "request_observation");
    assert.equal(event.sourceProvider, "fastly");
    assert.equal(event.observedAt, "2026-05-26T10:45:00.000Z");
    assert.deepEqual(event.request, {
      host: "www.example.com",
      path: "/pricing",
      search: "?plan=pro&utm_source=chatgpt",
      method: "GET",
      userAgent: "ChatGPT-User/1.0",
      referer: "https://chatgpt.com/share/example",
    });
    assert.deepEqual(event.providerClassification, {
      provider: "openai_chatgpt_user",
      agentType: "ai_browser_user",
      confidence: 0.96,
      matchedBy: ["user_agent"],
    });
    assert.deepEqual(event.location, { country: "US", region: "CA" });
    assert.deepEqual(event.integration, {
      name: "fastly-compute",
      requestId: "req-123",
    });
  });

  it("forwards the original request to origin and schedules ingest through the PromptScout backend", async () => {
    const { createFastlyComputeHandler } = await fastlyComputeModule();
    const fetchCalls = [];
    const scheduled = [];
    const originResponse = new Response("origin ok", { status: 203 });
    const handler = createFastlyComputeHandler({
      originBackend: "customer_origin",
      ingestBackend: "promptscout_ingest",
      ingestEndpoint: "https://ingest.promptscout.com/live-ai-traffic",
      ingestToken: "test-token",
      siteId: "site_123",
      fetch: async (resource, init) => {
        fetchCalls.push({ resource, init });

        if (init?.backend === "customer_origin") {
          return originResponse;
        }

        assert.equal(init?.backend, "promptscout_ingest");
        return new Response("", { status: 202 });
      },
      now: () => new Date("2026-05-26T10:50:00.000Z"),
    });
    const request = new Request("https://www.example.com/docs", {
      headers: { "user-agent": "GPTBot/1.3" },
    });

    const response = await handler({
      request,
      waitUntil: (promise) => scheduled.push(promise),
    });
    await Promise.all(scheduled);

    assert.equal(response, originResponse);
    assert.equal(scheduled.length, 1);
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0].resource, request);
    assert.deepEqual(fetchCalls[0].init, { backend: "customer_origin" });
    assert.equal(
      fetchCalls[1].resource,
      "https://ingest.promptscout.com/live-ai-traffic",
    );
    assert.equal(fetchCalls[1].init.method, "POST");
    assert.equal(fetchCalls[1].init.backend, "promptscout_ingest");
    assert.equal(fetchCalls[1].init.headers.authorization, "Bearer test-token");
    assert.equal(
      fetchCalls[1].init.headers["x-promptscout-site-id"],
      "site_123",
    );

    const body = JSON.parse(fetchCalls[1].init.body);
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].sourceProvider, "fastly");
    assert.equal(body.events[0].integration.name, "fastly-compute");
    assert.equal(
      body.events[0].providerClassification.provider,
      "openai_gptbot",
    );
  });

  it("keeps origin behavior intact when ingest fails", async () => {
    const { createFastlyComputeHandler } = await fastlyComputeModule();
    const originResponse = new Response("origin still served", { status: 200 });
    const scheduled = [];
    const handler = createFastlyComputeHandler({
      originBackend: "customer_origin",
      ingestBackend: "promptscout_ingest",
      ingestEndpoint: "https://ingest.promptscout.com/live-ai-traffic",
      ingestToken: "test-token",
      fetch: async (_resource, init) => {
        if (init?.backend === "customer_origin") {
          return originResponse;
        }

        return new Response("temporary outage", { status: 503 });
      },
      retry: { maxRetries: 0, baseDelayMs: 0 },
    });

    const response = await handler({
      request: new Request("https://www.example.com/"),
      waitUntil: (promise) => scheduled.push(promise),
    });
    const [ingestResult] = await Promise.all(scheduled);

    assert.equal(response, originResponse);
    assert.equal(ingestResult.ok, false);
    assert.equal(ingestResult.status, 503);
    assert.equal(ingestResult.retryable, true);
  });
});
