import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

let nodeMiddlewareModulePromise;

async function nodeMiddlewareModule() {
  if (!nodeMiddlewareModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/node-middleware"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    nodeMiddlewareModulePromise = import(
      "../packages/node-middleware/dist/index.js"
    );
  }

  return nodeMiddlewareModulePromise;
}

function request(overrides = {}) {
  return {
    method: "GET",
    url: "/pricing?utm_source=chatgpt&token=secret",
    headers: {
      host: "example.com",
      "user-agent": "GPTBot/1.3",
      referer: "https://chatgpt.com/share/example",
      "x-request-id": "req_123",
    },
    socket: {
      remoteAddress: "203.0.113.42",
    },
    ...overrides,
  };
}

function pendingClient(calls) {
  let resolveSend;
  const sendPromise = new Promise((resolve) => {
    resolveSend = resolve;
  });

  return {
    client: {
      send(event) {
        calls.push(event);
        return sendPromise;
      },
    },
    resolveSend,
  };
}

describe("generic Node live AI traffic middleware", () => {
  it("sends setup probes separately from AI traffic events", async () => {
    const { observeLiveAiTrafficNodeRequest } = await nodeMiddlewareModule();
    const sentProbes = [];

    const probe = await observeLiveAiTrafficNodeRequest(
      request({
        url: "/__promptscout/setup-probe",
        headers: {
          host: "example.com",
          "user-agent": "PromptScout-Setup-Probe/1.0",
          "x-promptscout-setup-probe": "1",
          "x-promptscout-probe-id": "probe_123",
          "x-promptscout-probe-token": "probe-token-123",
          "x-request-id": "req_probe",
        },
      }),
      {
        probeClient: {
          async sendProbe(event) {
            sentProbes.push(event);
            return {
              ok: true,
              status: 202,
              attempts: 1,
              retryable: false,
              authFailure: false,
            };
          },
        },
        now: () => new Date("2026-05-31T10:00:00.000Z"),
      },
    );

    assert.equal(sentProbes.length, 1);
    assert.deepEqual(probe, sentProbes[0]);
    assert.equal(probe.eventKind, "setup_probe");
    assert.equal(Object.hasOwn(probe, "providerClassification"), false);
    assert.deepEqual(probe.probe, {
      id: "probe_123",
      token: "probe-token-123",
    });
    assert.deepEqual(probe.request, {
      host: "example.com",
      path: "/__promptscout/setup-probe",
      method: "GET",
      userAgent: "PromptScout-Setup-Probe/1.0",
    });
  });

  it("builds a normalized event from a Node request and sends it with the shared ingest client", async () => {
    const { observeLiveAiTrafficNodeRequest } = await nodeMiddlewareModule();
    const sentEvents = [];
    const client = {
      async send(event) {
        sentEvents.push(event);
        return {
          ok: true,
          status: 202,
          attempts: 1,
          retryable: false,
          authFailure: false,
        };
      },
    };

    const event = await observeLiveAiTrafficNodeRequest(request(), {
      client,
      now: () => new Date("2026-05-26T10:00:00.000Z"),
      privacy: {
        query: { mode: "allowlist", allow: ["utm_source"] },
        ip: { mode: "none" },
      },
    });

    assert.equal(sentEvents.length, 1);
    assert.deepEqual(event, sentEvents[0]);
    assert.equal(event.sourceProvider, "node_express");
    assert.equal(event.observedAt, "2026-05-26T10:00:00.000Z");
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
    assert.deepEqual(event.ipHash, {
      algorithm: "none",
      originalIpRetention: "not_collected",
    });
    assert.deepEqual(event.integration, {
      kind: "node_express",
      name: "node-middleware",
      requestId: "req_123",
    });
  });

  it("skips non-AI requests without blocking the route handler", async () => {
    const { createExpressLiveAiTrafficMiddleware } =
      await nodeMiddlewareModule();
    const sentEvents = [];
    const middleware = createExpressLiveAiTrafficMiddleware({
      client: {
        async send(event) {
          sentEvents.push(event);
          return {
            ok: true,
            status: 202,
            attempts: 1,
            retryable: false,
            authFailure: false,
          };
        },
      },
    });
    const response = { statusCode: 200, body: "" };

    middleware(
      request({
        url: "/pricing",
        headers: {
          host: "example.com",
          "user-agent": "Mozilla/5.0",
        },
      }),
      response,
      () => {
        response.statusCode = 204;
        response.body = "route handled";
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(response.statusCode, 204);
    assert.equal(response.body, "route handled");
    assert.equal(sentEvents.length, 0);
  });

  it("classifies UTM-only ChatGPT referral visits with safe query attribution", async () => {
    const { observeLiveAiTrafficNodeRequest } = await nodeMiddlewareModule();
    const sentEvents = [];

    const event = await observeLiveAiTrafficNodeRequest(
      request({
        url: "/pricing?utm_source=chatgpt.com&prompt=private",
        headers: {
          host: "example.com",
          "user-agent": "Mozilla/5.0",
          "x-request-id": "req_utm_only",
        },
      }),
      {
        client: {
          async send(sentEvent) {
            sentEvents.push(sentEvent);
            return {
              ok: true,
              status: 202,
              attempts: 1,
              retryable: false,
              authFailure: false,
            };
          },
        },
        privacy: {
          query: { mode: "omit" },
          ip: { mode: "none" },
        },
      },
    );

    assert.equal(sentEvents.length, 1);
    assert.deepEqual(event.providerClassification, {
      provider: "openai_chatgpt_referral",
      agentType: "ai_referral_visit",
      confidence: 0.68,
      matchedBy: ["query"],
    });
    assert.equal(event.request.search, "?utm_source=chatgpt.com");
  });

  it("calls Express next before awaiting background delivery for AI requests", async () => {
    const { createExpressLiveAiTrafficMiddleware } =
      await nodeMiddlewareModule();
    const sentEvents = [];
    const { client, resolveSend } = pendingClient(sentEvents);
    const middleware = createExpressLiveAiTrafficMiddleware({
      client,
      now: () => new Date("2026-05-26T10:05:00.000Z"),
    });
    const response = { statusCode: 200, body: "" };
    let nextCalls = 0;

    middleware(request(), response, () => {
      nextCalls += 1;
      response.statusCode = 200;
      response.body = "ok";
    });

    assert.equal(nextCalls, 1);
    assert.equal(response.body, "ok");
    assert.equal(sentEvents.length, 0);

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(sentEvents.length, 1);
    assert.equal(
      sentEvents[0].providerClassification.provider,
      "openai_gptbot",
    );

    resolveSend({
      ok: true,
      status: 202,
      attempts: 1,
      retryable: false,
      authFailure: false,
    });
  });
});
