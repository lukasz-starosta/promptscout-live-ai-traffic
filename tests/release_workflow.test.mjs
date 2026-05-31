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
    const dryRunStep = workflow.match(
      /^ {6}- name: Dry-run package contents\n(?<body>(?:^ {8}.+\n?)*)/m,
    );

    assert.match(workflow, /^ {6}dry_run:\s*$/m);
    assert.match(workflow, /default:\s*true/);
    assert.match(workflow, /npm pack --dry-run/);
    assert.ok(dryRunStep?.groups?.body);
    assert.doesNotMatch(
      dryRunStep.groups.body,
      /^\s+if:/m,
      "package dry-run must run before both dry-run and real publish modes",
    );
    assert.match(workflow, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
    assert.match(workflow, /id-token:\s*write/);
    assert.match(workflow, /^ {4}environment:\s*npm$/m);
    assert.match(
      workflow,
      /npm publish --access public --provenance --registry=https:\/\/registry\.npmjs\.org/,
    );
    assert.doesNotMatch(workflow, /npm\.pkg\.github\.com/);
    assert.doesNotMatch(workflow, /packages:\s*write/);
    assert.doesNotMatch(workflow, /secrets\.GITHUB_TOKEN/);
    assert.doesNotMatch(workflow, /secrets\.NPM_TOKEN/);
    assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN/);
    assert.doesNotMatch(workflow, /--access restricted/);
  });

  it("documents public npm consumption and trusted publishing", async () => {
    const docs = await readFile(releaseDocsPath, "utf8");
    const changelog = await readFile(changelogPath, "utf8");

    for (const expected of [
      "@promptscout/live-ai-traffic",
      "@promptscout/live-ai-traffic/core",
      "@promptscout/live-ai-traffic/vercel-middleware",
      "registry.npmjs.org",
      "Trusted Publishing",
      "id-token: write",
      "npm",
      "npm login --registry=https://registry.npmjs.org",
      "npm whoami --registry=https://registry.npmjs.org",
      "npm publish --access public --registry=https://registry.npmjs.org",
      "npm view @promptscout/live-ai-traffic version --registry=https://registry.npmjs.org",
      "npm access grant read-write @promptscout:maintainers @promptscout/live-ai-traffic --registry=https://registry.npmjs.org",
      "npm trust github @promptscout/live-ai-traffic",
      "--repo lukasz-starosta/promptscout-live-ai-traffic",
      "--file release.yml",
      "--env npm",
      "--allow-publish",
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
      "NPM_TOKEN",
      "NODE_AUTH_TOKEN",
      "read:packages",
      "packages: write",
      "--access restricted",
    ]) {
      assert.doesNotMatch(docs, new RegExp(obsolete));
    }

    assert.match(changelog, /## 0\.1\.1/);
    assert.match(changelog, /## 0\.1\.0/);
    assert.match(changelog, /single public npm package/i);
  });

  it("keeps the root manifest as the only public npm package", async () => {
    const rootPackage = await readJson("package.json");
    const npmrc = await readFile(".npmrc", "utf8").catch(() => "");
    const yarnrc = await readFile(".yarnrc.yml", "utf8");

    assert.equal(rootPackage.name, "@promptscout/live-ai-traffic");
    assert.equal(rootPackage.version, "0.1.1");
    assert.notEqual(rootPackage.private, true);
    assert.deepEqual(rootPackage.files, [
      "dist",
      "docs",
      "docs-manifest.json",
      "README.md",
      "LICENSE",
    ]);
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
      "./docs-manifest.json": "./docs-manifest.json",
      "./package.json": "./package.json",
    });

    assert.doesNotMatch(npmrc, /lukasz-starosta|npm\.pkg\.github/);
    assert.doesNotMatch(yarnrc, /lukasz-starosta|npm\.pkg\.github/);
  });
});
