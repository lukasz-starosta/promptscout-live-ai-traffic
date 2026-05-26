import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const providers = [
  "vercel",
  "cloudflare",
  "cloudflare-worker",
  "netlify",
  "nginx-log-forwarder",
  "wordpress",
  "node-express",
  "cloudfront-aws",
  "fastly",
];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("monorepo scaffold", () => {
  it("uses Yarn workspaces for packages and examples", async () => {
    const rootPackage = await readJson("package.json");
    const lockfile = await readFile("yarn.lock", "utf8");

    assert.equal(rootPackage.packageManager, "yarn@4.9.2");
    assert.deepEqual(rootPackage.workspaces, ["packages/*", "examples/*"]);
    assert.match(lockfile, /promptscout-live-ai-traffic@workspace:\./);
  });

  it("lets every provider package import the shared core package", async () => {
    for (const provider of providers) {
      const packageJson = await readJson(`packages/${provider}/package.json`);
      const source = await readFile(
        `packages/${provider}/src/index.ts`,
        "utf8",
      );

      assert.equal(
        packageJson.dependencies["@promptscout/live-ai-traffic-core"],
        "workspace:*",
      );
      assert.match(source, /@promptscout\/live-ai-traffic-core/);
    }
  });

  it("keeps one workspace example and docs placeholder per provider", async () => {
    for (const provider of providers) {
      const examplePackage = await readJson(
        `examples/${provider}/package.json`,
      );
      const source = await readFile(
        `examples/${provider}/src/index.ts`,
        "utf8",
      );
      const integrationDoc = await readFile(
        `docs/integrations/${provider}.md`,
        "utf8",
      );

      assert.equal(
        examplePackage.dependencies[`@promptscout/live-ai-traffic-${provider}`],
        "workspace:*",
      );
      assert.match(
        source,
        new RegExp(`@promptscout/live-ai-traffic-${provider}`),
      );
      if (provider === "vercel") {
        assert.match(integrationDoc, /trackPromptScoutAiTraffic/);
        assert.match(integrationDoc, /matcher/i);
      } else if (provider === "cloudflare-worker") {
        assert.match(integrationDoc, /wrangler/i);
        assert.match(integrationDoc, /Cloudflare is the front door/i);
      } else if (provider === "cloudfront-aws") {
        assert.match(integrationDoc, /real-time access logs/i);
        assert.match(integrationDoc, /Kinesis Data Streams/i);
      } else {
        assert.match(integrationDoc, /intentionally deferred/i);
      }
    }
  });
});
