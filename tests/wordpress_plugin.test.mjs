import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalizeQueryAttributionValue(value) {
  const trimmed = value.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const withoutWww = withoutProtocol.replace(/^www\./, "");
  const hostLike = withoutWww.split(/[/?#]/, 1)[0] ?? withoutWww;

  return hostLike.replace(/[^a-z0-9]+/g, "");
}

describe("WordPress plugin collector", () => {
  it("ships a real installable plugin package and local Docker smoke example", async () => {
    const packageJson = await readJson(
      "packages/wordpress-plugin/package.json",
    );
    const plugin = await readFile(
      "packages/wordpress-plugin/promptscout-live-ai-traffic.php",
      "utf8",
    );
    const compose = await readFile("examples/wordpress/compose.yaml", "utf8");
    const readme = await readFile("examples/wordpress/README.md", "utf8");

    assert.equal(
      packageJson.name,
      "promptscout-live-ai-traffic-wordpress-plugin",
    );
    assert.match(plugin, /Plugin Name:\s*PromptScout Live AI Traffic/);
    assert.match(plugin, new RegExp(`Version:\\s*${packageJson.version}`));
    assert.match(plugin, /promptscout_live_ai_traffic_bootstrap/);
    assert.match(compose, /wordpress:php8\.2-apache/);
    assert.match(compose, /packages\/wordpress-plugin/);
    assert.match(readme, /docker compose up/);
    assert.match(
      readme,
      /PromptScout groups\s+traffic by the brand-owned site source attached to the ingest token/i,
    );
  });

  it("stores site-scoped settings in WordPress options without public token exposure", async () => {
    const settings = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-settings.php",
      "utf8",
    );

    assert.match(settings, /register_setting\(/);
    assert.match(settings, /promptscout_live_ai_traffic_options/);
    assert.match(settings, /ingest_token/);
    assert.match(settings, /ingest_url/);
    assert.match(settings, /privacy_mode/);
    assert.match(settings, /debug_mode/);
    assert.match(settings, /type="password"/);
    assert.doesNotMatch(settings, /brand[_-]?id/i);
    assert.doesNotMatch(settings, /team[_-]?site[_-]?id/i);
    assert.doesNotMatch(settings, /wp_localize_script|wp_add_inline_script/);
  });

  it("uses server-side request hooks and WordPress HTTP APIs to post normalized events", async () => {
    const pluginClass = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-plugin.php",
      "utf8",
    );
    const eventBuilder = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-event-builder.php",
      "utf8",
    );

    assert.match(pluginClass, /add_action\(\s*'template_redirect'/);
    assert.match(pluginClass, /wp_remote_post\(/);
    assert.match(pluginClass, /'Authorization'\s*=>\s*'Bearer '\s*\./);
    assert.match(pluginClass, /'Content-Type'\s*=>\s*'application\/json'/);
    assert.match(pluginClass, /wp_json_encode\(/);
    assert.match(pluginClass, /'blocking'\s*=>\s*false/);

    assert.match(eventBuilder, /'schemaVersion'\s*=>\s*1/);
    assert.match(eventBuilder, /'eventKind'\s*=>\s*'request_observation'/);
    assert.match(eventBuilder, /'sourceProvider'\s*=>\s*'wordpress'/);
    assert.match(eventBuilder, /'providerClassification'/);
    assert.match(eventBuilder, /'integration'\s*=>\s*\[/);
    assert.match(eventBuilder, /'name'\s*=>\s*'wordpress-plugin'/);
    assert.doesNotMatch(eventBuilder, /brand[_-]?id|team[_-]?site[_-]?id/i);
  });

  it("omits WordPress request query strings by default", async () => {
    const eventBuilder = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-event-builder.php",
      "utf8",
    );
    const requestUrl = "/pricing?plan=pro&token=secret";

    assert.match(eventBuilder, /REQUEST_URI/);
    assert.doesNotMatch(eventBuilder, /PHP_URL_QUERY/);
    assert.doesNotMatch(eventBuilder, /'search'\s*=>/);
    assert.equal(requestUrl.includes("token=secret"), true);
    assert.equal(eventBuilder.includes("token=secret"), false);
  });

  it("classifies UTM-only ChatGPT referrals from REQUEST_URI without storing the raw query", async () => {
    const pluginClass = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-plugin.php",
      "utf8",
    );
    const classifier = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-classifier.php",
      "utf8",
    );
    const eventBuilder = await readFile(
      "packages/wordpress-plugin/includes/class-promptscout-live-ai-traffic-event-builder.php",
      "utf8",
    );
    const pluginRules = await readJson(
      "packages/wordpress-plugin/includes/classifier-rules.json",
    );
    const requestUri =
      "/pricing?utm_source=chatgpt.com&utm_medium=referral&prompt=private";
    const normalizedSource = normalizeQueryAttributionValue(
      new URL(`https://example.test${requestUri}`).searchParams.get(
        "utm_source",
      ),
    );
    const queryRule = pluginRules.landingQueryAttributionRules.find(
      (rule) => rule.id === "query:openai:chatgpt",
    );

    assert.ok(queryRule, "plugin exports ChatGPT landing query attribution");
    assert.equal(queryRule.matchKind, "query");
    assert.ok(
      queryRule.patterns.some((pattern) =>
        new RegExp(pattern.source, pattern.flags).test(normalizedSource),
      ),
      "plugin query rule matches a UTM-only ChatGPT source",
    );
    assert.match(pluginClass, /\$_SERVER\['REQUEST_URI'\]\s*\?\?\s*null/);
    assert.match(pluginClass, /classification_query_source\(/);
    assert.match(
      pluginClass,
      /wp_parse_url\(\s*\$request_uri,\s*PHP_URL_QUERY\s*\)/,
    );
    assert.match(pluginClass, /\[\s*'utm_source',\s*'source'\s*\]/);
    assert.match(classifier, /landingQueryAttributionRules/);
    assert.match(classifier, /fallback:unknown-query/);
    assert.doesNotMatch(eventBuilder, /PHP_URL_QUERY/);
    assert.doesNotMatch(eventBuilder, /'search'\s*=>/);
    assert.equal(JSON.stringify(pluginRules).includes("prompt=private"), false);
  });

  it("keeps bundled PHP classifier rules aligned with the core export and fixtures", async () => {
    const coreRules = await readJson(
      "packages/core/fixtures/classifier/php-rules-export.json",
    );
    const pluginRules = await readJson(
      "packages/wordpress-plugin/includes/classifier-rules.json",
    );
    const userAgentFixtures = await readJson(
      "packages/core/fixtures/classifier/known-user-agents.json",
    );
    const referrerFixtures = await readJson(
      "packages/core/fixtures/classifier/known-referrers.json",
    );
    const queryFixtures = await readJson(
      "packages/core/fixtures/classifier/known-query-attribution.json",
    );

    assert.deepEqual(pluginRules, coreRules);
    assert.equal(coreRules.schemaVersion, 1);
    assert.equal(coreRules.generatedFrom, "packages/core/src/index.ts");
    assert.ok(coreRules.userAgentRules.length > 0);
    assert.ok(coreRules.refererRules.length > 0);
    assert.deepEqual(coreRules.landingQueryAttributionKeys, [
      "utm_source",
      "source",
    ]);
    assert.ok(coreRules.landingQueryAttributionRules.length > 0);

    const exportedRules = new Map(
      [
        ...coreRules.userAgentRules,
        ...coreRules.refererRules,
        ...coreRules.landingQueryAttributionRules,
      ].map((rule) => [rule.id, rule]),
    );

    for (const fixture of [...userAgentFixtures, ...referrerFixtures]) {
      const rule = exportedRules.get(fixture.matchedRule);

      assert.ok(rule, `${fixture.name}: exports ${fixture.matchedRule}`);
      assert.equal(
        rule.provider,
        fixture.provider,
        `${fixture.name}: provider`,
      );
      assert.equal(
        rule.agentType,
        fixture.agentType,
        `${fixture.name}: agentType`,
      );
      if (fixture.docsUrl) {
        assert.equal(rule.docsUrl, fixture.docsUrl, `${fixture.name}: docsUrl`);
      }
      assert.ok(
        rule.patterns.some((pattern) =>
          new RegExp(pattern.source, pattern.flags).test(
            fixture.userAgent ?? fixture.referer,
          ),
        ),
        `${fixture.name}: at least one exported pattern matches fixture`,
      );
    }

    const attributionKeys = new Set(coreRules.landingQueryAttributionKeys);
    for (const fixture of queryFixtures) {
      const rule = exportedRules.get(fixture.matchedRule);
      const landingUrl = new URL(fixture.landingUrl);
      const attributionValues = [...landingUrl.searchParams.entries()]
        .filter(([key]) => attributionKeys.has(key.toLowerCase()))
        .map(([, value]) => normalizeQueryAttributionValue(value));

      assert.ok(rule, `${fixture.name}: exports ${fixture.matchedRule}`);
      assert.equal(
        rule.provider,
        fixture.provider,
        `${fixture.name}: provider`,
      );
      assert.equal(
        rule.agentType,
        fixture.agentType,
        `${fixture.name}: agentType`,
      );
      assert.equal(rule.matchKind, "query", `${fixture.name}: matchKind`);
      if (fixture.docsUrl) {
        assert.equal(rule.docsUrl, fixture.docsUrl, `${fixture.name}: docsUrl`);
      }
      assert.ok(
        attributionValues.some((value) =>
          rule.patterns.some((pattern) =>
            new RegExp(pattern.source, pattern.flags).test(value),
          ),
        ),
        `${fixture.name}: at least one exported pattern matches fixture`,
      );
    }
  });
});
