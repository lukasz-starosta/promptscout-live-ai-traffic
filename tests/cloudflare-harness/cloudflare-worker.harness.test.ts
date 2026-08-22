import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

const network = setupServer();
const harness = createTestHarness({
  root: process.cwd(),
  workers: [
    {
      configPath: "./tests/cloudflare-harness/wrangler.jsonc",
      secrets: {
        PROMPTSCOUT_INGEST_TOKEN: "local-harness-token",
      },
      vars: {
        PROMPTSCOUT_INGEST_URL:
          "https://promptscout.test/ingest/live-ai-traffic",
        PROMPTSCOUT_PROBE_URL:
          "https://promptscout.test/ingest/live-ai-traffic/probe",
      },
    },
  ],
});

beforeAll(async () => {
  network.listen({ onUnhandledRequest: "error" });
  await harness.listen();
});

afterAll(async () => {
  await harness.close();
  network.close();
});

describe("Cloudflare production artifact harness", () => {
  it("executes the built Worker with mocked origin and ingest services", async () => {
    const observations: unknown[] = [];
    network.use(
      http.get("https://customer.example/docs", () => {
        return new HttpResponse("customer docs", { status: 200 });
      }),
      http.post(
        "https://promptscout.test/ingest/live-ai-traffic",
        async ({ request }) => {
          observations.push(await request.json());
          return new HttpResponse(null, { status: 202 });
        },
      ),
    );

    const response = await harness
      .getWorker()
      .fetch("https://customer.example/docs", {
        headers: { "user-agent": "GPTBot/1.0" },
      });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("customer docs");
    await expect.poll(() => observations.length).toBe(1);
  });
});
