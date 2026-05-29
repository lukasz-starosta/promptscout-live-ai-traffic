import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const fixtureDirectory = "packages/core/fixtures";
const acceptedFixtureDirectory = `${fixtureDirectory}/accepted`;
const rejectedFixtureDirectory = `${fixtureDirectory}/rejected`;

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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stringValueMatchesSchemaProperty(schemaProperty, value) {
  if (schemaProperty.type !== "string") {
    return false;
  }

  if (
    typeof schemaProperty.minLength === "number" &&
    value.length < schemaProperty.minLength
  ) {
    return false;
  }

  if (
    typeof schemaProperty.maxLength === "number" &&
    value.length > schemaProperty.maxLength
  ) {
    return false;
  }

  if (
    typeof schemaProperty.pattern === "string" &&
    !new RegExp(schemaProperty.pattern).test(value)
  ) {
    return false;
  }

  return true;
}

async function fixturePaths(directory) {
  return (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => `${directory}/${name}`);
}

describe("live AI traffic event contract", () => {
  it("accepts all committed common traffic fixtures", async () => {
    const { LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION, parseLiveAiTrafficEvent } =
      await coreModule();
    const { liveAiTrafficEventJsonSchema } = await coreModule();
    const paths = await fixturePaths(acceptedFixtureDirectory);

    assert.equal(
      liveAiTrafficEventJsonSchema.$id,
      "promptscout.liveAiTrafficEvent",
    );
    assert.equal(
      liveAiTrafficEventJsonSchema.properties.schemaVersion.minimum,
      LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    );

    assert.deepEqual(paths, [
      `${acceptedFixtureDirectory}/ai-referral-browser.json`,
      `${acceptedFixtureDirectory}/chatgpt-user.json`,
      `${acceptedFixtureDirectory}/claude-bot.json`,
      `${acceptedFixtureDirectory}/google-crawler-referral.json`,
      `${acceptedFixtureDirectory}/google-referral.json`,
      `${acceptedFixtureDirectory}/gptbot.json`,
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
      `${acceptedFixtureDirectory}/perplexity-bot.json`,
    ]);

    for (const path of paths) {
      const event = parseLiveAiTrafficEvent(await readJson(path));

      assert.ok(event.schemaVersion >= LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION);
      assert.equal(event.eventKind, "request_observation");
      assert.match(event.observedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.ok(event.request.host);
      assert.ok(event.request.path.startsWith("/"));
      assert.ok(event.providerClassification.confidence >= 0);
      assert.ok(event.providerClassification.confidence <= 1);
      assert.ok(event.integration?.kind, `${path}: integration.kind`);
    }
  });

  it("exports dashboard-safe provider buckets and signal families", async () => {
    const {
      getLiveAiTrafficProviderBucket,
      getLiveAiTrafficSignalFamily,
      liveAiTrafficProviderBuckets,
      liveAiTrafficSignalFamilies,
    } = await coreModule();

    assert.deepEqual(
      liveAiTrafficProviderBuckets.map((bucket) => bucket.id),
      [
        "openai_chatgpt",
        "anthropic_claude",
        "perplexity",
        "google_gemini",
        "microsoft_copilot",
        "meta_ai",
        "xai_grok",
        "mistral_le_chat",
        "other",
      ],
    );
    assert.deepEqual(
      liveAiTrafficSignalFamilies.map((family) => family.id),
      ["ai_bot_visit", "ai_referral_visit", "search_baseline", "other"],
    );

    assert.equal(
      getLiveAiTrafficProviderBucket("openai_gptbot"),
      "openai_chatgpt",
    );
    assert.equal(
      getLiveAiTrafficProviderBucket("anthropic_claude_referral"),
      "anthropic_claude",
    );
    assert.equal(getLiveAiTrafficProviderBucket("google_referral"), "other");
    assert.equal(getLiveAiTrafficProviderBucket("other"), "other");

    assert.equal(
      getLiveAiTrafficSignalFamily("ai_search_crawler"),
      "ai_bot_visit",
    );
    assert.equal(
      getLiveAiTrafficSignalFamily("ai_referral_visit"),
      "ai_referral_visit",
    );
    assert.equal(
      getLiveAiTrafficSignalFamily("search_referral"),
      "search_baseline",
    );
  });

  it("exports displayable integration origin kinds", async () => {
    const {
      getLiveAiTrafficIntegrationOrigin,
      liveAiTrafficIntegrationOrigins,
    } = await coreModule();

    assert.deepEqual(
      liveAiTrafficIntegrationOrigins.map((origin) => origin.kind),
      [
        "vercel_nextjs_middleware",
        "cloudflare_worker",
        "netlify_edge",
        "fastly_compute",
        "cloudfront_aws_realtime_logs",
        "nginx_log_forwarder",
        "wordpress_plugin",
        "node_express",
        "manual",
        "other",
      ],
    );
    assert.deepEqual(
      getLiveAiTrafficIntegrationOrigin("vercel_nextjs_middleware"),
      {
        kind: "vercel_nextjs_middleware",
        sourceProvider: "vercel",
        label: "Vercel / Next.js middleware",
      },
    );
    assert.deepEqual(getLiveAiTrafficIntegrationOrigin("not-real"), {
      kind: "other",
      sourceProvider: "other",
      label: "Other",
    });
  });

  it("parses events built from classifier output through the provider adapter", async () => {
    const {
      LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
      classifyAiTraffic,
      parseLiveAiTrafficEvent,
      toLiveAiTrafficProviderClassification,
    } = await coreModule();

    const classification = classifyAiTraffic({
      userAgent: "OAI-SearchBot/1.0",
      referer: "https://example.com/from-browser",
    });
    const providerClassification =
      toLiveAiTrafficProviderClassification(classification);

    assert.equal(classification.matchedRule, "ua:openai:oai-searchbot");
    assert.equal(Object.hasOwn(providerClassification, "matchedRule"), false);
    assert.equal(Object.hasOwn(providerClassification, "docsUrl"), false);

    const event = parseLiveAiTrafficEvent({
      schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
      eventKind: "request_observation",
      sourceProvider: "cloudflare",
      observedAt: "2026-05-26T07:05:00.000Z",
      request: {
        host: "example.com",
        path: "/guides/live-ai-traffic",
        method: "GET",
        userAgent: "OAI-SearchBot/1.0",
        referer: "https://example.com/from-browser",
      },
      providerClassification,
    });

    assert.equal(event.providerClassification.provider, "openai_search_bot");
    assert.deepEqual(event.providerClassification.matchedBy, ["user_agent"]);
  });

  it("accepts query as a first-class provider classification match signal", async () => {
    const {
      LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
      parseLiveAiTrafficEvent,
      toLiveAiTrafficProviderClassification,
    } = await coreModule();

    const event = parseLiveAiTrafficEvent({
      schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
      eventKind: "request_observation",
      sourceProvider: "vercel",
      observedAt: "2026-05-29T09:15:00.000Z",
      request: {
        host: "example.com",
        path: "/pricing",
        method: "GET",
        userAgent: "Mozilla/5.0",
      },
      providerClassification: toLiveAiTrafficProviderClassification({
        provider: "openai_chatgpt_referral",
        agentType: "ai_referral_visit",
        confidence: 0.68,
        matchedRule: "query:openai:chatgpt",
        matchedBy: ["query"],
      }),
    });

    assert.deepEqual(event.providerClassification.matchedBy, ["query"]);
  });

  it("rejects invalid fixtures instead of silently mapping critical enums", async () => {
    const { parseLiveAiTrafficEvent } = await coreModule();
    const paths = await fixturePaths(rejectedFixtureDirectory);

    assert.deepEqual(paths, [
      `${rejectedFixtureDirectory}/invalid-agent-type.json`,
      `${rejectedFixtureDirectory}/invalid-provider-classification.json`,
      `${rejectedFixtureDirectory}/invalid-source-provider.json`,
    ]);

    for (const path of paths) {
      const fixture = await readJson(path);

      assert.throws(
        () => parseLiveAiTrafficEvent(fixture),
        /Invalid live AI traffic event/,
      );
    }
  });

  it("parses future schema versions when known fields remain compatible", async () => {
    const { parseLiveAiTrafficEvent } = await coreModule();
    const fixture = await readJson(
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
    );

    const parsed = parseLiveAiTrafficEvent({
      ...fixture,
      schemaVersion: fixture.schemaVersion + 1,
      futureExtension: {
        ignoredByCurrentParser: true,
      },
    });

    assert.equal(parsed.schemaVersion, fixture.schemaVersion + 1);
    assert.equal(
      parsed.providerClassification.provider,
      fixture.providerClassification.provider,
    );
  });

  it("rejects unknown fields inside closed nested objects", async () => {
    const { parseLiveAiTrafficEvent } = await coreModule();
    const fixture = await readJson(
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
    );
    const nestedObjects = [
      "request",
      "providerClassification",
      "location",
      "ipHash",
      "integration",
    ];

    for (const field of nestedObjects) {
      const event = cloneJson(fixture);
      event[field].unexpectedField = true;

      assert.throws(
        () => parseLiveAiTrafficEvent(event),
        /Invalid live AI traffic event/,
      );
    }
  });

  it("rejects date-only observedAt values", async () => {
    const { parseLiveAiTrafficEvent } = await coreModule();
    const fixture = await readJson(
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
    );

    assert.throws(
      () =>
        parseLiveAiTrafficEvent({
          ...fixture,
          observedAt: "2026-05-26",
        }),
      /Invalid live AI traffic event/,
    );
  });

  it("rejects impossible observedAt calendar dates", async () => {
    const { parseLiveAiTrafficEvent } = await coreModule();
    const fixture = await readJson(
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
    );

    assert.throws(
      () =>
        parseLiveAiTrafficEvent({
          ...fixture,
          observedAt: "2026-02-31T00:00:00Z",
        }),
      /Invalid live AI traffic event/,
    );
  });

  it("accepts an empty request.search value", async () => {
    const { liveAiTrafficEventJsonSchema, parseLiveAiTrafficEvent } =
      await coreModule();
    const fixture = await readJson(
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
    );

    const parsed = parseLiveAiTrafficEvent({
      ...fixture,
      request: {
        ...fixture.request,
        search: "",
      },
    });

    assert.equal(parsed.request.search, "");
    assert.equal(
      stringValueMatchesSchemaProperty(
        liveAiTrafficEventJsonSchema.properties.request.properties.search,
        "",
      ),
      true,
    );
  });

  it("keeps schema string constraints aligned with parser rejections", async () => {
    const { liveAiTrafficEventJsonSchema, parseLiveAiTrafficEvent } =
      await coreModule();
    const fixture = await readJson(
      `${acceptedFixtureDirectory}/openai-search-bot.json`,
    );

    const cases = [
      {
        name: "request.search without a leading question mark",
        schemaProperty:
          liveAiTrafficEventJsonSchema.properties.request.properties.search,
        schemaValue: "utm_source=openai",
        event: {
          ...fixture,
          request: {
            ...fixture.request,
            search: "utm_source=openai",
          },
        },
      },
      {
        name: "lowercase location.country",
        schemaProperty:
          liveAiTrafficEventJsonSchema.properties.location.properties.country,
        schemaValue: "us",
        event: {
          ...fixture,
          location: {
            ...fixture.location,
            country: "us",
          },
        },
      },
      {
        name: "empty location.region",
        schemaProperty:
          liveAiTrafficEventJsonSchema.properties.location.properties.region,
        schemaValue: "",
        event: {
          ...fixture,
          location: {
            ...fixture.location,
            region: "",
          },
        },
      },
      {
        name: "empty ipHash.value",
        schemaProperty:
          liveAiTrafficEventJsonSchema.properties.ipHash.properties.value,
        schemaValue: "",
        event: {
          ...fixture,
          ipHash: {
            ...fixture.ipHash,
            value: "",
          },
        },
      },
      {
        name: "empty ipHash.keyId",
        schemaProperty:
          liveAiTrafficEventJsonSchema.properties.ipHash.properties.keyId,
        schemaValue: "",
        event: {
          ...fixture,
          ipHash: {
            ...fixture.ipHash,
            keyId: "",
          },
        },
      },
      {
        name: "empty integration.requestId",
        schemaProperty:
          liveAiTrafficEventJsonSchema.properties.integration.properties
            .requestId,
        schemaValue: "",
        event: {
          ...fixture,
          integration: {
            ...fixture.integration,
            requestId: "",
          },
        },
      },
    ];

    for (const { name, schemaProperty, schemaValue, event } of cases) {
      assert.throws(
        () => parseLiveAiTrafficEvent(event),
        /Invalid live AI traffic event/,
        `${name} should be rejected by the parser`,
      );
      assert.equal(
        stringValueMatchesSchemaProperty(schemaProperty, schemaValue),
        false,
        `${name} should also be rejected by the exported schema`,
      );
    }
  });
});
