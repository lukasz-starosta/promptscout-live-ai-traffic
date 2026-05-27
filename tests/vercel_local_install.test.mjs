import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("Vercel middleware local PromptScout install path", () => {
  it("documents and scripts a non-registry tarball workflow for PromptScout dogfooding", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const guide = await readFile("docs/integrations/vercel.md", "utf8");
    const exampleReadme = await readFile(
      "examples/vercel-nextjs/README.md",
      "utf8",
    );

    assert.equal(
      packageJson.scripts["pack:vercel-local"],
      "./scripts/pack-vercel-local",
    );

    const dryRun = execFileSync("./scripts/pack-vercel-local", [
      "--dry-run",
    ]).toString();

    for (const expected of [
      "yarn tsc -b packages/core packages/vercel-middleware",
      "@promptscout/live-ai-traffic-core",
      "@promptscout/live-ai-traffic-vercel-middleware",
      ".promptscout-local-packages/promptscout-live-ai-traffic-core-v0.0.0.tgz",
      ".promptscout-local-packages/promptscout-live-ai-traffic-vercel-middleware-v0.0.0.tgz",
      "No npm publish is required",
    ]) {
      assert.match(dryRun, new RegExp(escapeRegExp(expected)));
      assert.match(guide, new RegExp(escapeRegExp(expected)));
    }

    assert.match(exampleReadme, /pack:vercel-local/);
    assert.doesNotMatch(
      `${guide}\n${exampleReadme}`,
      /@promptscout\/live-ai-traffic-vercel(?!-middleware)/,
    );
  });

  it("packs middleware so a clean project imports it without resolving core from npm", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "promptscout-vercel-pack-"));
    const artifactDir = join(tempRoot, "artifacts");
    const projectDir = join(tempRoot, "project");
    const cacheDir = join(tempRoot, "yarn-cache");
    const middlewareTarball = join(
      artifactDir,
      "promptscout-live-ai-traffic-vercel-middleware-v0.0.0.tgz",
    );

    try {
      execFileSync("./scripts/pack-vercel-local", {
        env: {
          ...process.env,
          PROMPTSCOUT_LOCAL_PACK_DIR: artifactDir,
        },
        stdio: "pipe",
      });

      await mkdir(projectDir);
      await writeFile(
        join(projectDir, "package.json"),
        JSON.stringify(
          {
            name: "promptscout-vercel-local-install-test",
            private: true,
            type: "module",
            packageManager: "yarn@4.9.2",
          },
          null,
          2,
        ),
      );
      await writeFile(
        join(projectDir, ".yarnrc.yml"),
        [
          "nodeLinker: node-modules",
          "enableGlobalCache: false",
          "cacheFolder: .yarn/cache",
          "globalFolder: .yarn/global",
          'npmRegistryServer: "http://127.0.0.1:9"',
        ].join("\n"),
      );

      execFileSync(
        "yarn",
        [
          "add",
          `@promptscout/live-ai-traffic-vercel-middleware@file:${middlewareTarball}`,
        ],
        {
          cwd: projectDir,
          env: {
            ...process.env,
            YARN_CACHE_FOLDER: cacheDir,
            YARN_ENABLE_GLOBAL_CACHE: "false",
          },
          stdio: "pipe",
        },
      );

      execFileSync(
        "node",
        [
          "--input-type=module",
          "-e",
          "await import('@promptscout/live-ai-traffic-vercel-middleware')",
        ],
        {
          cwd: projectDir,
          stdio: "pipe",
        },
      );
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
