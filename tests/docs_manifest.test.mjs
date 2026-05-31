import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const requiredGuideIds = [
  "vercel-nextjs",
  "cloudflare-worker",
  "netlify-edge",
  "wordpress",
  "nginx-log-forwarder",
  "node-express",
  "cloudfront-aws",
  "fastly-compute",
  "cloudflare",
  "netlify",
  "fastly",
  "express",
];

async function readManifest() {
  return JSON.parse(await readFile("docs-manifest.json", "utf8"));
}

async function collectIntegrationGuidePaths() {
  const entries = await readdir("docs/integrations", { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `docs/integrations/${entry.name}`)
    .sort();
}

function assertGuideShape(guide) {
  assert.equal(typeof guide.id, "string");
  assert.match(guide.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(typeof guide.title, "string");
  assert.equal(typeof guide.shortDescription, "string");
  assert.equal(typeof guide.runtime, "string");
  assert.equal(typeof guide.platform, "string");
  assert.equal(typeof guide.packageName, "string");
  assert.ok(Array.isArray(guide.packageExports));
  assert.equal(typeof guide.markdownPath, "string");
  assert.match(guide.markdownPath, /^docs\/integrations\/[^/]+\.md$/);
  assert.match(guide.supportStatus, /^(current|preview|placeholder)$/);
  assert.equal(typeof guide.order, "number");
}

describe("docs manifest", () => {
  it("publishes stable metadata for every integration guide", async () => {
    const manifest = await readManifest();
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(
      packageJson.exports["./docs-manifest.json"],
      "./docs-manifest.json",
    );
    assert.match(manifest.betaNotice, /support@promptscout\.app/);
    assert.ok(Array.isArray(manifest.guides));

    const seenOrders = new Set();
    const guidesById = new Map();

    for (const guide of manifest.guides) {
      assertGuideShape(guide);
      assert.equal(guidesById.has(guide.id), false, guide.id);
      assert.equal(seenOrders.has(guide.order), false, String(guide.order));
      guidesById.set(guide.id, guide);
      seenOrders.add(guide.order);
    }

    assert.deepEqual(
      [...guidesById.keys()].sort(),
      [...requiredGuideIds].sort(),
    );
    assert.deepEqual(
      manifest.guides.map((guide) => guide.markdownPath).sort(),
      await collectIntegrationGuidePaths(),
    );

    assert.deepEqual(
      manifest.guides.map((guide) => guide.order),
      [...manifest.guides]
        .map((guide) => guide.order)
        .sort((left, right) => left - right),
    );
  });

  it("points every manifest entry at an existing markdown file", async () => {
    const manifest = await readManifest();

    for (const guide of manifest.guides) {
      const markdown = await readFile(guide.markdownPath, "utf8");
      assert.match(markdown, /^# /, guide.markdownPath);
    }
  });

  it("ships the manifest and referenced markdown files in the npm package", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "promptscout-docs-pack-"));

    try {
      execFileSync(
        "npm",
        ["pack", "--ignore-scripts", "--pack-destination", tempRoot],
        {
          env: {
            ...process.env,
            npm_config_cache: join(tempRoot, "npm-cache"),
          },
          stdio: "pipe",
        },
      );

      const tarball = join(tempRoot, "promptscout-live-ai-traffic-0.1.1.tgz");
      const packedFiles = execFileSync("tar", ["-tzf", tarball], {
        stdio: "pipe",
      })
        .toString()
        .trim()
        .split("\n");
      const packedFileSet = new Set(packedFiles);
      const manifest = await readManifest();

      assert.equal(packedFileSet.has("package/docs-manifest.json"), true);

      for (const guide of manifest.guides) {
        assert.equal(
          packedFileSet.has(`package/${guide.markdownPath}`),
          true,
          guide.markdownPath,
        );
      }
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});
