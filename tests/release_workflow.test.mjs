import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const releaseWorkflowPath = ".github/workflows/release.yml";
const releaseDocsPath = "docs/release.md";
const changelogPath = "CHANGELOG.md";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

describe("release workflow", () => {
  it("runs repo verification before any publish step", async () => {
    const workflow = await readFile(releaseWorkflowPath, "utf8");
    const verifyIndex = workflow.indexOf("run: ./scripts/verify");
    const publishIndex = workflow.indexOf("npm publish");

    assert.notEqual(verifyIndex, -1);
    assert.notEqual(publishIndex, -1);
    assert.ok(
      verifyIndex < publishIndex,
      "release workflow must verify before publishing the public package",
    );
  });

  it("supports dry-run and real public npm publish modes", async () => {
    const workflow = await readFile(releaseWorkflowPath, "utf8");

    assert.match(workflow, /^ {6}dry_run:\s*$/m);
    assert.match(workflow, /default:\s*true/);
    assert.match(workflow, /npm pack --dry-run/);
    assert.match(workflow, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
    assert.match(workflow, /secrets\.NPM_TOKEN/);
    assert.match(workflow, /npm publish --access public/);
    assert.doesNotMatch(workflow, /npm\.pkg\.github\.com/);
    assert.doesNotMatch(workflow, /packages:\s*write/);
    assert.doesNotMatch(workflow, /secrets\.GITHUB_TOKEN/);
    assert.doesNotMatch(workflow, /--access restricted/);
  });

  it("documents public npm consumption and removes GitHub Packages auth", async () => {
    const docs = await readFile(releaseDocsPath, "utf8");
    const changelog = await readFile(changelogPath, "utf8");

    for (const expected of [
      "@promptscout/live-ai-traffic",
      "@promptscout/live-ai-traffic/core",
      "@promptscout/live-ai-traffic/vercel-middleware",
      "registry.npmjs.org",
      "NPM_TOKEN",
      "./scripts/verify",
      "dry run",
      "0.1.0",
      "dry_run: false",
    ]) {
      assert.match(docs, new RegExp(expected));
    }

    for (const obsolete of [
      "@lukasz-starosta",
      "npm.pkg.github.com",
      "GITHUB_PACKAGES_TOKEN",
      "read:packages",
      "packages: write",
      "--access restricted",
    ]) {
      assert.doesNotMatch(docs, new RegExp(obsolete));
    }

    assert.match(changelog, /## 0\.1\.0/);
    assert.match(changelog, /single public npm package/i);
  });

  it("keeps the root manifest as the only public npm package", async () => {
    const rootPackage = await readJson("package.json");
    const npmrc = await readFile(".npmrc", "utf8").catch(() => "");
    const yarnrc = await readFile(".yarnrc.yml", "utf8");

    assert.equal(rootPackage.name, "@promptscout/live-ai-traffic");
    assert.equal(rootPackage.version, "0.1.0");
    assert.notEqual(rootPackage.private, true);
    assert.deepEqual(rootPackage.files, ["dist", "README.md", "LICENSE"]);
    assert.deepEqual(rootPackage.publishConfig, {
      access: "public",
      registry: "https://registry.npmjs.org",
    });
    assert.deepEqual(rootPackage.exports, {
      ".": {
        types: "./dist/packages/core/src/index.d.ts",
        default: "./dist/packages/core/src/index.js",
      },
      "./core": {
        types: "./dist/packages/core/src/index.d.ts",
        default: "./dist/packages/core/src/index.js",
      },
      "./vercel-middleware": {
        types: "./dist/packages/vercel-middleware/src/index.d.ts",
        default: "./dist/packages/vercel-middleware/src/index.js",
      },
      "./package.json": "./package.json",
    });

    assert.doesNotMatch(npmrc, /lukasz-starosta|npm\.pkg\.github/);
    assert.doesNotMatch(yarnrc, /lukasz-starosta|npm\.pkg\.github/);
  });
});
