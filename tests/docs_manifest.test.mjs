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

  // Optional: only guides that configure the token through a named environment
  // variable declare one. WordPress reads it from plugin settings and the
  // Compute collector takes it as a code option, so they intentionally omit it.
  if (guide.tokenEnvVar !== undefined) {
    assert.equal(typeof guide.tokenEnvVar, "string");
    assert.match(guide.tokenEnvVar, /^[A-Z][A-Z0-9_]*$/);
  }
}

describe("docs manifest", () => {
  it("declares the token variable each guide actually documents", async () => {
    const manifest = await readManifest();

    for (const guide of manifest.guides) {
      if (guide.tokenEnvVar === undefined) {
        continue;
      }

      const markdown = await readFile(guide.markdownPath, "utf8");
      assert.ok(
        markdown.includes(guide.tokenEnvVar),
        `${guide.id} declares ${guide.tokenEnvVar} but ${guide.markdownPath} never mentions it`,
      );
    }
  });

  it("publishes stable metadata for every integration guide", async () => {
    const manifest = await readManifest();
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(
      packageJson.exports["./docs-manifest.json"],
      "./docs-manifest.json",
    );
    assert.deepEqual(packageJson.exports["./docs-content"], {
      types: "./dist/docs-content.d.ts",
      default: "./dist/docs-content.js",
    });
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

  it("builds one JavaScript export from the manifest and source markdown", async () => {
    const manifest = await readManifest();
    const { liveAiTrafficDocs } = await import("../dist/docs-content.js");

    assert.deepEqual(
      liveAiTrafficDocs.guides.map(
        ({ markdown: _markdown, ...guide }) => guide,
      ),
      manifest.guides,
    );
    assert.deepEqual(
      {
        betaNotice: liveAiTrafficDocs.betaNotice,
        packageName: liveAiTrafficDocs.packageName,
        schemaVersion: liveAiTrafficDocs.schemaVersion,
      },
      {
        betaNotice: manifest.betaNotice,
        packageName: manifest.packageName,
        schemaVersion: manifest.schemaVersion,
      },
    );

    for (const guide of liveAiTrafficDocs.guides) {
      assert.equal(
        guide.markdown,
        await readFile(guide.markdownPath, "utf8"),
        guide.id,
      );
    }
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

      const tarball = join(tempRoot, "promptscout-live-ai-traffic-0.2.1.tgz");
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
