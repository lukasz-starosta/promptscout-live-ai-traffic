import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("public package install path", () => {
  it("packs a single package that exposes the Vercel middleware subpath", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "promptscout-public-pack-"));
    const projectDir = join(tempRoot, "project");
    const cacheDir = join(tempRoot, "yarn-cache");

    try {
      execFileSync("npm", ["pack", "--pack-destination", tempRoot], {
        env: {
          ...process.env,
          npm_config_cache: join(tempRoot, "npm-cache"),
        },
        stdio: "pipe",
      });

      const packedFiles = await readdir(tempRoot);
      const tarballs = packedFiles.filter((file) => file.endsWith(".tgz"));

      assert.deepEqual(tarballs, ["promptscout-live-ai-traffic-0.1.1.tgz"]);

      await mkdir(projectDir);
      await writeFile(
        join(projectDir, "package.json"),
        JSON.stringify(
          {
            name: "promptscout-public-install-test",
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
          `@promptscout/live-ai-traffic@file:${join(tempRoot, tarballs[0])}`,
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

      const importOutput = execFileSync(
        "node",
        [
          "--input-type=module",
          "-e",
          [
            "const middleware = await import('@promptscout/live-ai-traffic/vercel-middleware');",
            "const core = await import('@promptscout/live-ai-traffic/core');",
            "console.log(typeof middleware.trackPromptScoutAiTraffic);",
            "console.log(core.LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION);",
          ].join(""),
        ],
        {
          cwd: projectDir,
          stdio: "pipe",
        },
      ).toString();

      assert.equal(importOutput, "function\n1\n");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("does not keep the temporary local tarball path as a public install path", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const guide = await readFile("docs/integrations/vercel.md", "utf8");
    const exampleReadme = await readFile(
      "examples/vercel-nextjs/README.md",
      "utf8",
    );
    const vercelExampleReadme = await readFile(
      "examples/vercel/README.md",
      "utf8",
    );

    assert.equal(packageJson.scripts["pack:vercel-local"], undefined);

    for (const obsolete of [
      "pack:vercel-local",
      "pack-vercel-local",
      ".promptscout-local-packages",
      "@lukasz-starosta",
      "promptscout-live-ai-traffic-core-v0.0.0.tgz",
      "promptscout-live-ai-traffic-vercel-middleware-v0.0.0.tgz",
    ]) {
      assert.doesNotMatch(
        `${guide}\n${exampleReadme}\n${vercelExampleReadme}`,
        new RegExp(obsolete),
      );
    }
  });

  it("marks non-Vercel collector imports as repo-local private workspace examples", async () => {
    const repoLocalImportDocs = [
      "docs/integrations/cloudflare-worker.md",
      "docs/integrations/cloudfront-aws.md",
      "docs/integrations/express.md",
      "docs/integrations/fastly-compute.md",
      "docs/integrations/netlify-edge.md",
      "docs/integrations/nginx-log-forwarder.md",
      "examples/cloudflare-worker/README.md",
      "examples/fastly-compute/README.md",
    ];

    for (const path of repoLocalImportDocs) {
      const contents = await readFile(path, "utf8");

      assert.match(contents, /repo-local\s+private workspace/i, path);
      assert.doesNotMatch(
        contents,
        /@promptscout\/live-ai-traffic\/(?:cloudflare|cloudflare-worker|cloudfront|cloudfront-aws|express|fastly|fastly-compute|netlify|netlify-edge|nginx-log-forwarder|node-middleware)/,
        path,
      );
    }
  });
});
