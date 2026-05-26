import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function file(path) {
  return readFile(path, "utf8");
}

async function exists(path) {
  await access(path);
}

describe("cloudflare worker example", () => {
  it("ships a runnable Wrangler example workspace", async () => {
    await exists("examples/cloudflare-worker/package.json");
    await exists("examples/cloudflare-worker/tsconfig.json");
    await exists("examples/cloudflare-worker/wrangler.toml");
    await exists("examples/cloudflare-worker/src/index.ts");

    const packageJson = JSON.parse(
      await file("examples/cloudflare-worker/package.json"),
    );
    assert.equal(
      packageJson.dependencies[
        "@promptscout/live-ai-traffic-cloudflare-worker"
      ],
      "workspace:*",
    );
    assert.match(packageJson.scripts.dev, /wrangler(?:@latest)? dev/);
    assert.match(packageJson.scripts.deploy, /wrangler(?:@latest)? deploy/);

    const source = await file("examples/cloudflare-worker/src/index.ts");
    assert.match(source, /@promptscout\/live-ai-traffic-cloudflare-worker/);
    assert.match(source, /export default worker/);

    const wranglerToml = await file("examples/cloudflare-worker/wrangler.toml");
    assert.match(wranglerToml, /main = "src\/index\.ts"/);
    assert.match(wranglerToml, /compatibility_date = "\d{4}-\d{2}-\d{2}"/);
    assert.match(wranglerToml, /PROMPTSCOUT_INGEST_URL/);
    assert.match(wranglerToml, /PROMPTSCOUT_QUERY_POLICY/);
    assert.doesNotMatch(wranglerToml, /PROMPTSCOUT_INGEST_TOKEN/);
  });

  it("documents install, route, ownership, and smoke-test steps", async () => {
    const readme = await file("examples/cloudflare-worker/README.md");
    const integrationDoc = await file("docs/integrations/cloudflare-worker.md");
    const combined = `${readme}\n${integrationDoc}`;

    assert.match(
      combined,
      /yarn workspace @promptscout\/live-ai-traffic-example-cloudflare-worker dev/,
    );
    assert.match(
      combined,
      /wrangler(?:@latest)? --cwd examples\/cloudflare-worker secret put PROMPTSCOUT_INGEST_TOKEN/,
    );
    assert.match(
      combined,
      /wrangler(?:@latest)? --cwd examples\/cloudflare-worker deploy/,
    );
    assert.match(combined, /routes = \[/);
    assert.match(combined, /curl/);
    assert.match(combined, /mock/i);
    assert.match(
      combined,
      /non-committed `examples\/cloudflare-worker\/\.dev\.vars`/,
    );
    assert.match(combined, /PROMPTSCOUT_INGEST_TOKEN=local-smoke-token/);
    assert.match(
      combined,
      /PROMPTSCOUT_INGEST_URL=http:\/\/127\.0\.0\.1:9000\/live-ai-traffic\/ingest/,
    );
    assert.match(combined, /Cloudflare is the front door/i);
    assert.match(combined, /origin remains (Vercel|Webflow|WordPress)/i);
    assert.match(combined, /DNS\/origin failures/i);
    assert.match(combined, /SSL/i);
    assert.match(combined, /one-click\/OAuth/i);
  });
});
