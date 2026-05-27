import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const exampleRoot = "examples/vercel-nextjs";

async function readExampleFile(path) {
  return readFile(`${exampleRoot}/${path}`, "utf8");
}

describe("Vercel Next.js example", () => {
  it("documents the copyable Next.js 16 proxy setup and token-owned site grouping", async () => {
    const readme = await readExampleFile("README.md");
    const envExample = await readExampleFile(".env.example");
    const proxy = await readExampleFile("proxy.ts");

    assert.match(readme, /Next\.js 16 `proxy\.ts`/);
    assert.match(readme, /older `middleware\.ts`/);
    assert.match(readme, /request-level visits/i);
    assert.match(readme, /not ChatGPT answer mentions/i);
    assert.match(readme, /site source attached to the ingest token/i);
    assert.match(readme, /Local curl simulation/);
    assert.match(readme, /Vercel deploy/);
    assert.match(readme, /node examples\/vercel-nextjs\/smoke-test\.mjs/);

    assert.match(envExample, /^PROMPTSCOUT_INGEST_TOKEN=/m);
    assert.match(envExample, /^PROMPTSCOUT_INGEST_URL=/m);
    assert.doesNotMatch(envExample, /BRAND_ID|TEAM_SITE_ID|SITE_ID/);

    assert.match(proxy, /export (?:const|function) proxy/);
    assert.match(proxy, /trackPromptScoutAiTraffic/);
    assert.match(proxy, /PROMPTSCOUT_INGEST_TOKEN/);
    assert.match(proxy, /PROMPTSCOUT_INGEST_URL/);
    assert.doesNotMatch(proxy, /siteId:/);
  });

  it("includes a ChatGPT-User fixture and a successful mocked event post", async () => {
    const fixture = JSON.parse(
      await readExampleFile("fixtures/chatgpt-user-request.json"),
    );

    assert.equal(fixture.headers["user-agent"], "ChatGPT-User/1.0");

    execFileSync("yarn", ["tsc", "-b", "packages/vercel-middleware"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });

    const output = execFileSync("node", [
      "examples/vercel-nextjs/smoke-test.mjs",
    ]).toString();

    const result = JSON.parse(output);
    assert.deepEqual(result, {
      ok: true,
      status: 202,
      postedEvents: 1,
      provider: "openai_chatgpt_user",
    });
  });
});
