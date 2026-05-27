import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const releaseWorkflowPath = ".github/workflows/release.yml";
const releaseDocsPath = "docs/release.md";
const changelogPath = "CHANGELOG.md";
const privatePackageScope = "@lukasz-starosta";
const githubPackagesRegistry = "https://npm.pkg.github.com";
const privatePackageNamePattern = new RegExp(
  `^${privatePackageScope}/promptscout-live-ai-traffic-`,
);
const privateExampleNamePattern = new RegExp(
  `^${privatePackageScope}/promptscout-live-ai-traffic-example-`,
);
const publishedPackageDirectories = [
  "packages/core",
  "packages/vercel-middleware",
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function packageDirectories() {
  const entries = await readdir("packages", { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join("packages", entry.name))
    .sort();
}

async function exampleDirectories() {
  const entries = await readdir("examples", { withFileTypes: true });
  const directories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory = path.join("examples", entry.name);
    try {
      await access(path.join(directory, "package.json"));
      directories.push(directory);
    } catch {
      // Compose-only examples are not package-managed workspaces.
    }
  }

  return directories.sort();
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
      "release workflow must verify before publishing packages",
    );
  });

  it("supports dry-run and real JS package publish modes", async () => {
    const workflow = await readFile(releaseWorkflowPath, "utf8");

    assert.match(workflow, /^ {6}dry_run:\s*$/m);
    assert.match(workflow, /default:\s*true/);
    assert.match(workflow, /yarn pack --dry-run/);
    assert.match(workflow, /registry-url:\s*https:\/\/npm\.pkg\.github\.com/);
    assert.match(workflow, /scope:\s*"@lukasz-starosta"/);
    assert.match(workflow, /packages:\s*write/);
    assert.match(workflow, /secrets\.GITHUB_TOKEN/);
    assert.match(workflow, /yarn npm publish --access restricted$/m);
    assert.doesNotMatch(workflow, /registry\.npmjs\.org/);
    assert.doesNotMatch(workflow, /NPM_TOKEN/);
    assert.doesNotMatch(workflow, /--access public/);
  });

  it("documents private GitHub Packages consumption and defers public npm", async () => {
    const docs = await readFile(releaseDocsPath, "utf8");
    const changelog = await readFile(changelogPath, "utf8");

    for (const expected of [
      "GitHub Packages",
      "@lukasz-starosta",
      "npm.pkg.github.com",
      ".npmrc",
      "GITHUB_PACKAGES_TOKEN",
      "read:packages",
      "version pin",
      "GITHUB_TOKEN",
      "packages: write",
      "./scripts/verify",
      "dry run",
      "public npm",
      "0.0.0",
      "dry_run: false",
    ]) {
      assert.match(docs, new RegExp(expected));
    }

    assert.match(changelog, /## 0\.0\.0/);
    assert.match(changelog, /release workflow/i);
  });

  it("keeps package names scoped to GitHub Packages", async () => {
    const rootPackage = await readJson("package.json");
    const npmrc = await readFile(".npmrc", "utf8");
    const yarnrc = await readFile(".yarnrc.yml", "utf8");

    for (const directory of await packageDirectories()) {
      const packageJson = await readJson(`${directory}/package.json`);

      assert.equal(packageJson.version, rootPackage.version);
      assert.match(packageJson.name, privatePackageNamePattern);
      assert.notEqual(
        packageJson.private,
        true,
        `${directory} must keep publishable package metadata`,
      );
      assert.deepEqual(packageJson.repository, {
        type: "git",
        url: "https://github.com/lukasz-starosta/promptscout-live-ai-traffic.git",
      });
      assert.deepEqual(packageJson.publishConfig, {
        access: "restricted",
        registry: githubPackagesRegistry,
      });
    }

    for (const directory of await exampleDirectories()) {
      const packageJson = await readJson(`${directory}/package.json`);

      assert.equal(packageJson.version, rootPackage.version);
      assert.match(packageJson.name, privateExampleNamePattern);
      assert.equal(
        packageJson.private,
        true,
        `${directory} is a runnable example and must not be published`,
      );
    }

    assert.match(
      npmrc,
      /@lukasz-starosta:registry=https:\/\/npm\.pkg\.github\.com/,
    );
    assert.match(yarnrc, /lukasz-starosta:/);
    assert.match(
      yarnrc,
      /npmPublishRegistry: "https:\/\/npm\.pkg\.github\.com"/,
    );
    assert.match(
      yarnrc,
      /npmRegistryServer: "https:\/\/npm\.pkg\.github\.com"/,
    );
  });

  it("publishes only the Vercel middleware and required shared package", async () => {
    const workflow = await readFile(releaseWorkflowPath, "utf8");

    for (const directory of publishedPackageDirectories) {
      const packageJson = await readJson(`${directory}/package.json`);

      assert.match(workflow, new RegExp(`${directory.replace("/", "\\/")}`));
      assert.deepEqual(packageJson.files, ["dist"]);
      assert.equal(packageJson.main, "./dist/index.js");
      assert.equal(packageJson.types, "./dist/index.d.ts");
      assert.deepEqual(packageJson.exports, {
        ".": {
          types: "./dist/index.d.ts",
          default: "./dist/index.js",
        },
      });
    }

    assert.doesNotMatch(
      workflow,
      /for manifest in packages\/\*\/package\.json/,
    );
    assert.doesNotMatch(workflow, /examples\/\*/);
  });
});
