import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const releaseWorkflowPath = ".github/workflows/release.yml";
const releaseDocsPath = "docs/release.md";
const changelogPath = "CHANGELOG.md";

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

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join("examples", entry.name))
    .sort();
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
    assert.match(workflow, /yarn npm publish --access public$/m);
    assert.match(workflow, /NPM_TOKEN/);
  });

  it("documents JS, WordPress, and Docker release paths", async () => {
    const docs = await readFile(releaseDocsPath, "utf8");
    const changelog = await readFile(changelogPath, "utf8");

    for (const expected of [
      "JavaScript packages",
      "WordPress artifacts",
      "Docker images",
      "./scripts/verify",
      "dry run",
    ]) {
      assert.match(docs, new RegExp(expected));
    }

    assert.match(changelog, /## 0\.0\.0/);
    assert.match(changelog, /release workflow/i);
  });

  it("keeps package and example versioning consistent", async () => {
    const rootPackage = await readJson("package.json");

    for (const directory of await packageDirectories()) {
      const packageJson = await readJson(`${directory}/package.json`);

      assert.equal(packageJson.version, rootPackage.version);
      assert.notEqual(
        packageJson.private,
        true,
        `${directory} must be publishable by the release workflow`,
      );
      assert.deepEqual(packageJson.publishConfig, { access: "public" });
    }

    for (const directory of await exampleDirectories()) {
      const packageJson = await readJson(`${directory}/package.json`);

      assert.equal(packageJson.version, rootPackage.version);
      assert.equal(
        packageJson.private,
        true,
        `${directory} is a runnable example and must not be published`,
      );
    }
  });
});
