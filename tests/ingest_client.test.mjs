import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

const TEST_INGEST_TOKEN = "test-ingest-token";
const TEST_SIGNING_KEY = "test-signing-key";

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

function fixtureEvent(overrides = {}) {
  return {
    schemaVersion: 1,
    eventKind: "request_observation",
    sourceProvider: "vercel",
    observedAt: "2026-05-26T09:30:00.000Z",
    request: {
      host: "example.com",
      path: "/pricing",
      search: "?utm_source=chatgpt&plan=pro&token=secret",
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
    ...overrides,
  };
}

function aiReferralVisitEvent(overrides = {}) {
  return fixtureEvent({
    request: {
      host: "example.com",
      path: "/pricing",
      search: "?utm_source=chatgpt.com&prompt=secret",
      method: "GET",
      userAgent: "Mozilla/5.0",
      referer:
        "https://chatgpt.com/share/example?utm_source=chatgpt.com&prompt=secret#details",
    },
    providerClassification: {
      provider: "openai_chatgpt_referral",
      agentType: "ai_referral_visit",
      confidence: 0.78,
      matchedBy: ["referer"],
    },
    ...overrides,
  });
}

function response(status, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

describe("live AI traffic ingest client", () => {
  it("sends token-authenticated event batches without exposing raw secrets", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url, init });
      return response(202);
    };
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      siteId: "site_123",
      fetch,
    });

    const result = await client.sendBatch([fixtureEvent()]);

    assert.equal(result.ok, true);
    assert.equal(result.status, 202);
    assert.equal(result.attempts, 1);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://promptscout.example/ingest/live-ai-traffic",
    );
    assert.equal(calls[0].init.method, "POST");
    assert.equal(
      calls[0].init.headers.authorization,
      `Bearer ${TEST_INGEST_TOKEN}`,
    );
    assert.equal(calls[0].init.headers["x-promptscout-site-id"], "site_123");
    assert.equal(calls[0].init.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      events: [fixtureEvent()],
    });
    assert.equal(JSON.stringify(calls[0].init).includes("supabase"), false);
  });

  it("removes raw query strings from AI referral visits before forwarding", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    const calls = [];
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async (url, init) => {
        calls.push({ url, init });
        return response(202);
      },
    });

    await client.send(aiReferralVisitEvent());

    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.events[0].request.search, undefined);
    assert.equal(
      body.events[0].request.referer,
      "https://chatgpt.com/share/example",
    );
    assert.equal(calls[0].init.body.includes("utm_source"), false);
    assert.equal(calls[0].init.body.includes("prompt=secret"), false);
    assert.equal(calls[0].init.body.includes("#details"), false);
  });

  it("keeps safe landing query attribution for query-classified AI referral visits", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    const calls = [];
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async (url, init) => {
        calls.push({ url, init });
        return response(202);
      },
    });

    await client.send(
      aiReferralVisitEvent({
        request: {
          host: "example.com",
          path: "/pricing",
          search:
            "?utm_source=chatgpt.com&utm_medium=referral&prompt=secret&email=person@example.com",
          method: "GET",
          userAgent: "Mozilla/5.0",
        },
        providerClassification: {
          provider: "openai_chatgpt_referral",
          agentType: "ai_referral_visit",
          confidence: 0.68,
          matchedBy: ["query"],
        },
      }),
    );

    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.events[0].request.search, "?utm_source=chatgpt.com");
    assert.equal(calls[0].init.body.includes("prompt=secret"), false);
    assert.equal(calls[0].init.body.includes("person@example.com"), false);
    assert.equal(calls[0].init.body.includes("utm_medium"), false);
  });

  it("can sign event batches with a deterministic Web Crypto HMAC", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    const calls = [];
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      signingSecret: TEST_SIGNING_KEY,
      now: () => new Date("2026-05-26T09:35:00.000Z"),
      fetch: async (url, init) => {
        calls.push({ url, init });
        return response(202);
      },
    });

    await client.send(fixtureEvent());

    assert.equal(
      calls[0].init.headers["x-promptscout-timestamp"],
      "2026-05-26T09:35:00.000Z",
    );
    assert.match(
      calls[0].init.headers["x-promptscout-signature"],
      /^sha256=[a-f0-9]{64}$/,
    );
  });

  it("does not retry auth failures or non-retryable responses", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    let attempts = 0;
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async () => {
        attempts += 1;
        return response(401, "bad token");
      },
      retry: { maxRetries: 3, baseDelayMs: 0 },
    });

    const result = await client.send(fixtureEvent());

    assert.equal(attempts, 1);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(result.authFailure, true);
    assert.equal(result.retryable, false);
    assert.equal(result.responseBody, "bad token");

    attempts = 0;
    const malformedClient = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async () => {
        attempts += 1;
        return response(400, "bad event");
      },
      retry: { maxRetries: 3, baseDelayMs: 0 },
    });
    const malformedResult = await malformedClient.send(fixtureEvent());

    assert.equal(attempts, 1);
    assert.equal(malformedResult.ok, false);
    assert.equal(malformedResult.status, 400);
    assert.equal(malformedResult.authFailure, false);
    assert.equal(malformedResult.retryable, false);
  });

  it("retries network failures and retryable HTTP responses with backoff", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    const delays = [];
    let attempts = 0;
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("socket closed");
        }
        if (attempts === 2) {
          return response(503, "try again");
        }

        return response(200);
      },
      retry: {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      },
    });

    const result = await client.send(fixtureEvent());

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.attempts, 3);
    assert.deepEqual(delays, [10, 20]);
  });

  it("returns network failure details after retries are exhausted", async () => {
    const { createLiveAiTrafficIngestClient } = await coreModule();
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async () => {
        throw new Error("offline");
      },
      retry: { maxRetries: 1, baseDelayMs: 0 },
    });

    const result = await client.send(fixtureEvent());

    assert.equal(result.ok, false);
    assert.equal(result.status, undefined);
    assert.equal(result.attempts, 2);
    assert.equal(result.retryable, true);
    assert.equal(result.error.message, "offline");
  });
});

describe("live AI traffic privacy helpers", () => {
  it("hashes IP addresses deterministically per salt and can omit IP metadata", async () => {
    const { hashLiveAiTrafficIp, normalizeLiveAiTrafficEvent } =
      await coreModule();
    const first = await hashLiveAiTrafficIp("203.0.113.42", {
      salt: `site_123:${TEST_INGEST_TOKEN}`,
      keyId: "site_123",
    });
    const second = await hashLiveAiTrafficIp("203.0.113.42", {
      salt: `site_123:${TEST_INGEST_TOKEN}`,
      keyId: "site_123",
    });
    const differentSalt = await hashLiveAiTrafficIp("203.0.113.42", {
      salt: `site_456:${TEST_INGEST_TOKEN}`,
      keyId: "site_456",
    });

    assert.equal(first.algorithm, "hmac-sha256");
    assert.equal(first.value, second.value);
    assert.notEqual(first.value, differentSalt.value);
    assert.equal(first.keyId, "site_123");
    assert.equal(first.originalIpRetention, "discarded_after_hash");

    const omitted = await normalizeLiveAiTrafficEvent(fixtureEvent(), {
      ip: { mode: "omit", value: "203.0.113.42" },
    });
    const disabled = await normalizeLiveAiTrafficEvent(fixtureEvent(), {
      ip: { mode: "disabled", value: "203.0.113.42" },
    });

    assert.equal(Object.hasOwn(omitted, "ipHash"), false);
    assert.deepEqual(disabled.ipHash, {
      algorithm: "none",
      originalIpRetention: "not_collected",
    });
  });

  it("filters paths, query strings, and headers by explicit privacy policy", async () => {
    const { filterLiveAiTrafficHeaders, normalizeLiveAiTrafficEvent } =
      await coreModule();
    const normalized = await normalizeLiveAiTrafficEvent(fixtureEvent(), {
      path: { mode: "redact", replacement: "/_promptscout/redacted" },
      query: { mode: "allowlist", allow: ["plan"] },
      ip: {
        mode: "hash",
        value: "203.0.113.42",
        salt: `site_123:${TEST_INGEST_TOKEN}`,
      },
    });

    assert.equal(normalized.request.path, "/_promptscout/redacted");
    assert.equal(normalized.request.search, "?plan=pro");
    assert.equal(normalized.ipHash.algorithm, "hmac-sha256");
    assert.equal(JSON.stringify(normalized).includes("203.0.113.42"), false);
    assert.equal(JSON.stringify(normalized).includes("token=secret"), false);

    const normalizedReferral = await normalizeLiveAiTrafficEvent(
      aiReferralVisitEvent(),
      {
        query: { mode: "allowlist", allow: ["utm_source"] },
      },
    );
    assert.equal(normalizedReferral.request.search, undefined);
    assert.equal(
      normalizedReferral.request.referer,
      "https://chatgpt.com/share/example",
    );
    assert.equal(
      JSON.stringify(normalizedReferral).includes("prompt=secret"),
      false,
    );

    const normalizedQueryReferral = await normalizeLiveAiTrafficEvent(
      aiReferralVisitEvent({
        request: {
          host: "example.com",
          path: "/pricing",
          search: "?utm_source=chatgpt.com&prompt=secret",
          method: "GET",
          userAgent: "Mozilla/5.0",
        },
        providerClassification: {
          provider: "openai_chatgpt_referral",
          agentType: "ai_referral_visit",
          confidence: 0.68,
          matchedBy: ["query"],
        },
      }),
      {
        query: { mode: "omit" },
      },
    );
    assert.equal(
      normalizedQueryReferral.request.search,
      "?utm_source=chatgpt.com",
    );

    const normalizedLegacyOpenAiQueryReferral =
      await normalizeLiveAiTrafficEvent(
        aiReferralVisitEvent({
          request: {
            host: "example.com",
            path: "/pricing",
            search:
              "?source=https%3A%2F%2Fwww.chat.openai.com%2Fshare%2Fabc&prompt=secret",
            method: "GET",
            userAgent: "Mozilla/5.0",
          },
          providerClassification: {
            provider: "openai_chatgpt_referral",
            agentType: "ai_referral_visit",
            confidence: 0.68,
            matchedBy: ["query"],
          },
        }),
        {
          query: { mode: "omit" },
        },
      );
    assert.equal(
      normalizedLegacyOpenAiQueryReferral.request.search,
      "?utm_source=chat.openai.com",
    );

    const normalizedMalformedQueryReferral = await normalizeLiveAiTrafficEvent(
      aiReferralVisitEvent({
        request: {
          host: "example.com",
          path: "/pricing",
          search: "?utm_source=cha%3Atgpt.com&prompt=secret",
          method: "GET",
          userAgent: "Mozilla/5.0",
        },
        providerClassification: {
          provider: "openai_chatgpt_referral",
          agentType: "ai_referral_visit",
          confidence: 0.68,
          matchedBy: ["query"],
        },
      }),
      {
        query: { mode: "omit" },
      },
    );
    assert.equal(
      normalizedMalformedQueryReferral.request.search,
      "?utm_source=chatgpt.com",
    );
    assert.equal(
      JSON.stringify(normalizedMalformedQueryReferral).includes("cha%3A"),
      false,
    );

    assert.deepEqual(
      filterLiveAiTrafficHeaders(
        {
          Authorization: "Bearer raw-secret",
          "User-Agent": "OAI-SearchBot/1.0",
          Referer:
            "https://chatgpt.com/share/example?utm_source=chatgpt.com&prompt=secret#details",
          "X-Forwarded-For": "203.0.113.42",
        },
        ["user-agent", "referer"],
      ),
      {
        "user-agent": "OAI-SearchBot/1.0",
        referer: "https://chatgpt.com/share/example",
      },
    );
  });

  it("supports batching plus blocking, waitUntil, and log-forwarder delivery modes", async () => {
    const {
      createLiveAiTrafficBatcher,
      createLiveAiTrafficIngestClient,
      deliverLiveAiTrafficEvent,
    } = await coreModule();
    const sentBodies = [];
    const client = createLiveAiTrafficIngestClient({
      endpoint: "https://promptscout.example/ingest/live-ai-traffic",
      ingestToken: TEST_INGEST_TOKEN,
      fetch: async (_url, init) => {
        sentBodies.push(JSON.parse(init.body));
        return response(202);
      },
    });
    const batcher = createLiveAiTrafficBatcher({ maxBatchSize: 2 });

    assert.equal(
      batcher.push(fixtureEvent({ observedAt: "2026-05-26T09:31:00.000Z" })),
      undefined,
    );
    assert.equal(
      batcher.push(fixtureEvent({ observedAt: "2026-05-26T09:32:00.000Z" }))
        .length,
      2,
    );
    assert.deepEqual(batcher.flush(), []);

    const waitUntilPromises = [];
    const waitUntilResult = deliverLiveAiTrafficEvent({
      mode: "waitUntil",
      event: fixtureEvent(),
      client,
      waitUntil: (promise) => waitUntilPromises.push(promise),
    });
    const logForwarderRecords = [];
    const logForwarderResult = deliverLiveAiTrafficEvent({
      mode: "logForwarder",
      event: fixtureEvent(),
      client,
      logForwarder: (event) => logForwarderRecords.push(event),
    });
    const blockingResult = await deliverLiveAiTrafficEvent({
      mode: "blocking",
      event: fixtureEvent(),
      client,
    });

    assert.equal(waitUntilResult.mode, "waitUntil");
    assert.equal(waitUntilPromises.length, 1);
    await waitUntilPromises[0];
    assert.equal(logForwarderResult.mode, "logForwarder");
    assert.equal(logForwarderRecords.length, 1);
    assert.equal(blockingResult.ok, true);
    assert.equal(sentBodies.length, 2);
  });
});
