import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const workflowPath = ".github/workflows/verify.yml";

async function readWorkflow() {
  return readFile(workflowPath, "utf8");
}

describe("GitHub Actions verification workflow", () => {
  it("runs on pull requests and pushes to main", async () => {
    const workflow = await readWorkflow();

    assert.match(workflow, /^ {2}pull_request:\s*$/m);
    assert.match(workflow, /^ {2}push:\s*$/m);
    assert.match(workflow, /^ {6}- main\s*$/m);
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
});
