import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

let cloudFrontModulePromise;

async function cloudFrontModule() {
  if (!cloudFrontModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/cloudfront-aws"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    cloudFrontModulePromise = import(
      "../packages/cloudfront-aws/dist/index.js"
    );
  }

  return cloudFrontModulePromise;
}

async function readText(path) {
  return readFile(path, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

describe("CloudFront AWS real-time log collector", () => {
  it("documents real-time logs through Kinesis as the supported AWS path", async () => {
    const { cloudFrontAwsImplementationDecision } = await cloudFrontModule();

    assert.equal(
      cloudFrontAwsImplementationDecision.selectedPath,
      "cloudfront-realtime-logs-kinesis",
    );
    assert.match(
      cloudFrontAwsImplementationDecision.note,
      /CloudFront real-time access logs/i,
    );
    assert.match(cloudFrontAwsImplementationDecision.note, /Kinesis/i);
    assert.match(
      cloudFrontAwsImplementationDecision.unsupportedPaths.join(" "),
      /CloudFront Functions/i,
    );
  });

  it("parses fixture real-time log records into PromptScout events", async () => {
    const {
      buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord,
      recommendedCloudFrontRealtimeLogFields,
    } = await cloudFrontModule();
    const record = await readText(
      "packages/cloudfront-aws/fixtures/realtime-log-record.tsv",
    );

    const event = await buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord(
      record,
      {
        fields: recommendedCloudFrontRealtimeLogFields,
        privacy: {
          query: { mode: "allowlist", allow: ["utm_source"] },
          ip: { mode: "disabled" },
        },
      },
    );

    assert.equal(event.sourceProvider, "cloudfront_aws");
    assert.equal(event.observedAt, "2026-05-26T09:30:00.000Z");
    assert.deepEqual(event.request, {
      host: "www.example.com",
      path: "/pricing",
      search: "?utm_source=chatgpt",
      method: "GET",
      userAgent: "OAI-SearchBot/1.0",
      referer: "https://chatgpt.com/share/example",
    });
    assert.equal(event.providerClassification.provider, "openai_search_bot");
    assert.deepEqual(event.providerClassification.matchedBy, ["user_agent"]);
    assert.deepEqual(event.location, { country: "US" });
    assert.deepEqual(event.ipHash, {
      algorithm: "none",
      originalIpRetention: "not_collected",
    });
    assert.deepEqual(event.integration, {
      name: "cloudfront-aws-realtime-logs",
      requestId: "cloudfront-request-123",
    });
  });

  it("omits fixture query strings by default", async () => {
    const {
      buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord,
      recommendedCloudFrontRealtimeLogFields,
    } = await cloudFrontModule();
    const record = await readText(
      "packages/cloudfront-aws/fixtures/realtime-log-record.tsv",
    );

    const event = await buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord(
      record,
      {
        fields: recommendedCloudFrontRealtimeLogFields,
      },
    );

    assert.equal(event.request.search, undefined);
    assert.equal(JSON.stringify(event).includes("token=secret"), false);
  });

  it("accepts AWS-style numeric real-time log timestamps", async () => {
    const {
      buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord,
      recommendedCloudFrontRealtimeLogFields,
    } = await cloudFrontModule();
    const record = await readText(
      "packages/cloudfront-aws/fixtures/realtime-log-record-numeric-timestamp.tsv",
    );

    const event = await buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord(
      record,
      {
        fields: recommendedCloudFrontRealtimeLogFields,
      },
    );

    assert.equal(event.observedAt, "2026-05-26T09:30:00.123Z");
  });

  it("builds events from local Lambda/Kinesis fixture records without AWS calls", async () => {
    const { buildPromptScoutCloudFrontAwsEventsFromKinesisEvent } =
      await cloudFrontModule();
    const fixture = await readJson(
      "packages/cloudfront-aws/fixtures/kinesis-event.json",
    );

    const events = await buildPromptScoutCloudFrontAwsEventsFromKinesisEvent(
      fixture,
      {
        privacy: { query: { mode: "omit" }, ip: { mode: "disabled" } },
      },
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].request.search, undefined);
    assert.equal(events[0].integration.requestId, "cloudfront-request-123");
  });

  it("forwards Kinesis fixture events through mocked PromptScout ingest", async () => {
    const { handlePromptScoutCloudFrontAwsKinesisEvent } =
      await cloudFrontModule();
    const fixture = await readJson(
      "packages/cloudfront-aws/fixtures/kinesis-event.json",
    );
    const calls = [];

    const result = await handlePromptScoutCloudFrontAwsKinesisEvent(
      fixture,
      {
        PROMPTSCOUT_INGEST_URL:
          "https://promptscout.example/live-ai-traffic/ingest",
        PROMPTSCOUT_INGEST_TOKEN: "test-ingest-token",
      },
      {
        privacy: { query: { mode: "omit" }, ip: { mode: "disabled" } },
        fetch: async (url, init) => {
          calls.push({ url, init });
          return { ok: true, status: 202 };
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://promptscout.example/live-ai-traffic/ingest",
    );
    assert.equal(
      calls[0].init.headers.authorization,
      "Bearer test-ingest-token",
    );
    assert.equal(JSON.parse(calls[0].init.body).events.length, 1);
  });

  it("rejects invalid-shape and malformed fixture input", async () => {
    const {
      buildPromptScoutCloudFrontAwsEventsFromKinesisEvent,
      parseCloudFrontRealtimeLogRecord,
      recommendedCloudFrontRealtimeLogFields,
    } = await cloudFrontModule();

    assert.throws(
      () =>
        parseCloudFrontRealtimeLogRecord("2026-05-26T09:30:00Z\tGET", {
          fields: recommendedCloudFrontRealtimeLogFields,
        }),
      /expected 12 CloudFront real-time log fields/i,
    );

    await assert.rejects(
      () =>
        buildPromptScoutCloudFrontAwsEventsFromKinesisEvent({
          Records: [{ kinesis: { data: 42 } }],
        }),
      /Kinesis record data must be a base64 string/i,
    );

    await assert.rejects(
      () => buildPromptScoutCloudFrontAwsEventsFromKinesisEvent(undefined),
      /Kinesis event must contain a Records array/i,
    );
  });

  it("returns a valid empty batch for Kinesis events with no records", async () => {
    const { buildPromptScoutCloudFrontAwsEventsFromKinesisEvent } =
      await cloudFrontModule();

    const events = await buildPromptScoutCloudFrontAwsEventsFromKinesisEvent({
      Records: [],
    });

    assert.deepEqual(events, []);
  });
});
