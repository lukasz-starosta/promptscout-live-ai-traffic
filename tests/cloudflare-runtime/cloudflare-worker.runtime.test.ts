import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import worker from "../../dist/cloudflare-deploy/promptscout-traffic-worker.mjs";
import { network } from "./network";

declare module "cloudflare:workers" {
  interface ProvidedEnv {
    PROMPTSCOUT_INGEST_TOKEN: string;
    PROMPTSCOUT_INGEST_URL: string;
    PROMPTSCOUT_PROBE_URL: string;
  }
}

describe("generated Cloudflare Worker artifact", () => {
  it("verifies setup without contacting the customer origin", async () => {
    const probes: unknown[] = [];
    network.use(
      http.get("https://customer.example/__promptscout/setup-probe", () => {
        throw new Error("Setup probes must not reach the customer origin");
      }),
      http.post(env.PROMPTSCOUT_PROBE_URL, async ({ request }) => {
        probes.push(await request.json());
        return new HttpResponse(null, { status: 202 });
      }),
    );

    const context = createExecutionContext();
    const response = await worker.fetch(
      new Request("https://customer.example/__promptscout/setup-probe", {
        headers: {
          "x-promptscout-setup-probe": "1",
          "x-promptscout-probe-id": "probe_123",
          "x-promptscout-probe-token": "probe-token-123",
        },
      }),
      env,
      context,
    );

    expect(response.status).toBe(204);
    await waitOnExecutionContext(context);
    expect(probes).toHaveLength(1);
  });

  it("passes through origin traffic and sends a private background observation", async () => {
    const observations: unknown[] = [];
    network.use(
      http.get("https://customer.example/article", () => {
        return new HttpResponse("origin response", { status: 203 });
      }),
      http.post(env.PROMPTSCOUT_INGEST_URL, async ({ request }) => {
        observations.push(await request.json());
        return new HttpResponse(null, { status: 202 });
      }),
    );

    const context = createExecutionContext();
    const response = await worker.fetch(
      new Request("https://customer.example/article", {
        headers: {
          "cf-connecting-ip": "203.0.113.42",
          cookie: "session=private",
          "user-agent": "OAI-SearchBot/1.0",
        },
      }),
      env,
      context,
    );

    expect(response.status).toBe(203);
    expect(await response.text()).toBe("origin response");
    await waitOnExecutionContext(context);
    expect(observations).toHaveLength(1);
    const serialized = JSON.stringify(observations[0]);
    expect(serialized).not.toContain("203.0.113.42");
    expect(serialized).not.toContain("session=private");
  });

  it("keeps customer traffic available when PromptScout ingest fails", async () => {
    network.use(
      http.get("https://customer.example/pricing", () => {
        return new HttpResponse("pricing", { status: 200 });
      }),
      http.post(env.PROMPTSCOUT_INGEST_URL, () => {
        return HttpResponse.error();
      }),
    );

    const context = createExecutionContext();
    const response = await worker.fetch(
      new Request("https://customer.example/pricing", {
        headers: { "user-agent": "ClaudeBot/1.0" },
      }),
      env,
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pricing");
    await waitOnExecutionContext(context);
  });

  it("runs the configured main Worker through Cloudflare's integration export", async () => {
    network.use(
      http.get("https://customer.example/robots.txt", () => {
        return new HttpResponse("User-agent: *", { status: 200 });
      }),
      http.post(env.PROMPTSCOUT_INGEST_URL, () => {
        return new HttpResponse(null, { status: 202 });
      }),
    );

    const response = await exports.default.fetch(
      new Request("https://customer.example/robots.txt", {
        headers: { "user-agent": "PerplexityBot/1.0" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("User-agent: *");
  });
});
