import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { describe, it } from "node:test";

const guidePath = "docs/install-matrix-and-signal-quality.md";
const requiredProviders = [
  "Vercel middleware",
  "Cloudflare Worker",
  "Netlify Edge",
  "nginx logs",
  "WordPress plugin",
  "Node/Express",
  "CloudFront/AWS",
  "Fastly Compute",
];
const currentInstallPaths = [
  "Vercel middleware",
  "Cloudflare Worker",
  "CloudFront/AWS",
  "Netlify Edge",
  "nginx logs",
  "WordPress plugin",
  "Node/Express",
  "Fastly Compute",
];
const deferredPlaceholderShells = [
  "packages/vercel",
  "packages/cloudflare",
  "packages/netlify",
  "packages/node-express",
  "packages/fastly",
  "packages/wordpress",
];

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}

describe("install matrix docs", () => {
  it("covers the required provider matrix and customer token model", async () => {
    const guide = await readFile(guidePath, "utf8");

    for (const provider of requiredProviders) {
      assert.match(guide, new RegExp(provider.replace("/", "\\/")));
    }

    assert.match(guide, /site-scoped PromptScout ingest token/i);
    assert.match(guide, /one brand-owned site source/i);
    assert.match(guide, /Do not add a separate brand ID, team-site ID/i);
    assert.match(guide, /Client-side pixels run only after/i);
    assert.match(guide, /AI crawler visit/i);
    assert.match(guide, /AI user fetch/i);
    assert.match(guide, /AI referral/i);
    assert.match(guide, /ChatGPT answer mention/i);
    assert.match(guide, /collector event by itself cannot establish this/i);
  });

  it("separates current install choices from placeholder adapters", async () => {
    const guide = await readFile(guidePath, "utf8");

    assert.match(guide, /Current local or customer install paths/i);
    assert.match(guide, /Deferred placeholder shells/i);
    assert.match(
      guide,
      /runtime implementation and customer install instructions are\s+intentionally deferred/i,
    );

    for (const provider of currentInstallPaths) {
      assert.match(
        guide,
        new RegExp(
          `\\| ${provider.replace("/", "\\/")} \\| Current(?: local dogfood target| local adapter| AWS path)? \\|`,
        ),
      );
    }

    for (const shell of deferredPlaceholderShells) {
      assert.match(guide, new RegExp(shell.replace("/", "\\/")));
    }
  });

  it("points Vercel customers at the public package and subpath export", async () => {
    const guide = await readFile(guidePath, "utf8");

    assert.match(guide, /npm install @promptscout\/live-ai-traffic@0\.1\.2/);
    assert.match(guide, /@promptscout\/live-ai-traffic\/vercel-middleware/);
    assert.doesNotMatch(
      guide,
      /Vercel middleware[\s\S]{0,220}(?:local checkout|local tarballs|packed\s+tarballs)[\s\S]{0,120}until public packages exist/i,
    );
    assert.match(
      guide,
      /(?:a\s+)?local checkout\s+or (?:generated )?tarballs only for (?:repository|repo) development workflows/i,
    );
  });

  it("does not ask customers for a separate site identifier in docs", async () => {
    const docs = [
      ...(await collectMarkdownFiles("docs")),
      ...(await collectMarkdownFiles("examples")),
    ];

    for (const path of docs) {
      const source = await readFile(path, "utf8");
      assert.doesNotMatch(source, /PROMPTSCOUT_SITE_ID/);
      assert.doesNotMatch(source, /siteId:\s*process\.env/);
      assert.doesNotMatch(source, /siteId:\s*["']/);
      assert.doesNotMatch(source, /placeholder token and site ID/i);
    }
  });

  it("documents setup probe support or unavailability in every integration guide", async () => {
    const docs = await collectMarkdownFiles("docs/integrations");

    for (const path of docs) {
      const source = await readFile(path, "utf8");

      assert.match(source, /## Setup Probe/i, `${path}: setup probe section`);
      assert.match(
        source,
        /setup_probe|not available|does not expose a runtime collector or probe path/i,
        `${path}: setup probe contract or availability note`,
      );
    }
  });

  it("keeps local documentation links resolvable", async () => {
    const markdownFiles = [
      "README.md",
      ...(await collectMarkdownFiles("docs")),
    ];

    for (const path of markdownFiles) {
      const source = await readFile(path, "utf8");
      const links = source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

      for (const [, href] of links) {
        if (
          href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("mailto:") ||
          href.startsWith("#")
        ) {
          continue;
        }

        const target = href.split("#")[0];
        if (!target) {
          continue;
        }

        await access(normalize(join(dirname(path), target)));
      }
    }
  });
});
