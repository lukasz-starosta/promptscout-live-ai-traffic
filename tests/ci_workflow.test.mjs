import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const workflowsDir = ".github/workflows";
const workflowPath = ".github/workflows/verify.yml";
const verificationDocsPath = "docs/verification.md";

async function readWorkflow() {
  return readFile(workflowPath, "utf8");
}

async function readVerificationDocs() {
  return readFile(verificationDocsPath, "utf8");
}

async function readWorkflowJobNames() {
  const workflowFiles = (await readdir(workflowsDir))
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .sort();
  const jobNames = [];

  for (const file of workflowFiles) {
    const workflow = await readFile(`${workflowsDir}/${file}`, "utf8");
    for (const match of workflow.matchAll(/^ {4}name: (?<name>.+)\s*$/gm)) {
      jobNames.push({ file, name: match.groups.name });
    }
  }

  return jobNames;
}

describe("GitHub Actions verification workflow", () => {
  it("runs on pull requests and pushes to main", async () => {
    const workflow = await readWorkflow();

    assert.match(workflow, /^ {2}pull_request:\s*$/m);
    assert.match(workflow, /^ {2}push:\s*$/m);
    assert.match(workflow, /^ {6}- main\s*$/m);
  });

  it("uses stable unique check names for required PR gates", async () => {
    const workflow = await readWorkflow();

    assert.match(workflow, /^name: Verify\s*$/m);
    assert.match(workflow, /^ {4}name: Live traffic verification\s*$/m);
    assert.match(workflow, /^ {4}name: Release readiness package dry run\s*$/m);
    assert.match(workflow, /^ {4}needs: verify\s*$/m);

    const checkNames = [
      ...workflow.matchAll(/^ {4}name: (?<name>.+)\s*$/gm),
    ].map((match) => match.groups.name);
    assert.deepEqual(checkNames, [
      "Live traffic verification",
      "Release readiness package dry run",
    ]);
    assert.equal(new Set(checkNames).size, checkNames.length);
  });

  it("keeps workflow job names unique across GitHub Actions", async () => {
    const jobNames = await readWorkflowJobNames();
    const duplicateNames = jobNames
      .map(({ name }) => name)
      .filter((name, index, names) => names.indexOf(name) !== index);

    assert.deepEqual(
      duplicateNames,
      [],
      `duplicate workflow job names: ${duplicateNames.join(", ")}`,
    );
  });

  it("uses the Yarn lockfile contract and repo verification commands", async () => {
    const workflow = await readWorkflow();

    for (const expected of [
      "corepack enable",
      "yarn install --immutable",
      "yarn lint",
      "yarn typecheck",
      "yarn build",
      "yarn test",
      "./scripts/verify",
    ]) {
      assert.match(workflow, new RegExp(expected.replaceAll(".", "\\.")));
    }

    const setupNodeIndex = workflow.indexOf("uses: actions/setup-node@v4");
    const corepackIndex = workflow.indexOf("run: corepack enable");
    const installIndex = workflow.indexOf("run: yarn install --immutable");

    assert.ok(setupNodeIndex < corepackIndex);
    assert.ok(corepackIndex < installIndex);
    assert.doesNotMatch(workflow, /cache:\s*yarn/);
  });

  it("runs a required release-readiness package dry run after verification", async () => {
    const workflow = await readWorkflow();
    const releaseReadinessIndex = workflow.indexOf("  release-readiness:");
    const releaseReadinessJob = workflow.slice(releaseReadinessIndex);

    assert.notEqual(releaseReadinessIndex, -1);
    assert.match(releaseReadinessJob, /needs: verify/);
    assert.match(releaseReadinessJob, /run: yarn install --immutable/);
    assert.match(releaseReadinessJob, /run: yarn build:package/);
    assert.match(releaseReadinessJob, /run: npm pack --dry-run/);
  });

  it("documents the stable required check names", async () => {
    const docs = await readVerificationDocs();

    assert.match(docs, /Live traffic verification/);
    assert.match(docs, /Release readiness package dry run/);
    assert.match(docs, /required status\s+checks/);
    assert.match(docs, /unique across all workflows/);
  });
});
