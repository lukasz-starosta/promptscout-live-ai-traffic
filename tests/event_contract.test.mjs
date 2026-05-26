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
    }
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
