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
  "Fastly",
];
const currentInstallPaths = [
  "Vercel middleware",
  "Cloudflare Worker",
  "WordPress plugin",
  "Netlify Edge",
];
const deferredInstallPaths = [
  "nginx logs",
  "Node/Express",
  "CloudFront/AWS",
  "Fastly",
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

    assert.match(guide, /Current customer install paths/i);
    assert.match(guide, /Future placeholder paths/i);
    assert.match(
      guide,
      /runtime implementation and customer install instructions are\s+intentionally deferred/i,
    );

    for (const provider of currentInstallPaths) {
      assert.match(
        guide,
        new RegExp(`\\| ${provider.replace("/", "\\/")} \\| Current \\|`),
      );
    }

    for (const provider of deferredInstallPaths) {
      assert.match(
        guide,
        new RegExp(
          `\\| ${provider.replace("/", "\\/")} \\| Future placeholder \\|`,
        ),
      );
    }
  });

  it("does not ask customers for a separate site identifier in docs", async () => {
    const docs = await collectMarkdownFiles("docs");

    for (const path of docs) {
      const source = await readFile(path, "utf8");
      assert.doesNotMatch(source, /PROMPTSCOUT_SITE_ID/);
      assert.doesNotMatch(source, /siteId:\s*process\.env/);
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
