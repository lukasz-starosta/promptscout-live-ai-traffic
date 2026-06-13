import { readFile } from "node:fs/promises";
import { trackPromptScoutAiTraffic } from "../../packages/vercel-middleware/dist/index.js";

const fixture = JSON.parse(
  await readFile(
    new URL("./fixtures/chatgpt-user-request.json", import.meta.url),
  ),
);
const calls = [];
const waitUntilPromises = [];

const request = {
  ...fixture,
  headers: new Headers(fixture.headers),
};

const result = trackPromptScoutAiTraffic(
  request,
  {
    waitUntil(promise) {
      waitUntilPromises.push(promise);
    },
  },
  {
    endpoint: "https://promptscout.example/api/live-ai-traffic/ingest",
    ingestToken: "ps_live_ai_traffic_test_token",
    now: () => new Date("2026-05-26T10:00:00.000Z"),
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 202,
        text: async () => "",
      };
    },
    privacy: {
      query: { mode: "omit" },
      ip: { mode: "disabled" },
    },
  },
);

if (!result.tracked) {
  throw new Error(`Expected fixture to be tracked, got ${result.reason}`);
}

await Promise.all(waitUntilPromises);

if (calls.length !== 1) {
  throw new Error(`Expected one mocked ingest call, got ${calls.length}`);
}

const body = JSON.parse(calls[0].init.body);
const event = body.events[0];

console.log(
  JSON.stringify({
    ok: true,
    status: 202,
    postedEvents: body.events.length,
    provider: event.providerClassification.provider,
  }),
);
