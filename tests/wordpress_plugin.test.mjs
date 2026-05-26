import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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
      "@promptscout/live-ai-traffic-wordpress-plugin",
    );
    assert.match(plugin, /Plugin Name:\s*PromptScout Live AI Traffic/);
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

    assert.deepEqual(pluginRules, coreRules);
    assert.equal(coreRules.schemaVersion, 1);
    assert.equal(coreRules.generatedFrom, "packages/core/src/index.ts");
    assert.ok(coreRules.userAgentRules.length > 0);
    assert.ok(coreRules.refererRules.length > 0);

    const exportedRules = new Map(
      [...coreRules.userAgentRules, ...coreRules.refererRules].map((rule) => [
        rule.id,
        rule,
      ]),
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
  });
});
