import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("Cloudflare deploy artifact is self-contained and matches its manifest", async () => {
  const [packageJson, deployConfig, manifest, deployModule] = await Promise.all(
    [
      readJson("package.json"),
      readJson("packages/cloudflare-worker/deploy-config.json"),
      readJson("dist/cloudflare-deploy/manifest.json"),
      import("../dist/cloudflare-deploy/index.js"),
    ],
  );
  const workerScript = await readFile(
    `dist/cloudflare-deploy/${manifest.mainModule}`,
    "utf8",
  );
  const checksum = createHash("sha256").update(workerScript).digest("hex");

  assert.equal(manifest.packageVersion, packageJson.version);
  assert.equal(manifest.compatibilityDate, deployConfig.compatibilityDate);
  assert.equal(manifest.mainModule, deployConfig.mainModule);
  assert.equal(manifest.sha256, checksum);
  assert.equal(manifest.byteLength, Buffer.byteLength(workerScript));
  assert.equal(deployModule.cloudflareWorkerScript, workerScript);
  assert.deepEqual(deployModule.cloudflareWorkerManifest, manifest);
  assert.match(workerScript, /export\s*\{/);
  assert.doesNotMatch(workerScript, /from\s+["']@promptscout\//);
  assert.doesNotMatch(workerScript, /require\s*\(/);
});

test("published package exports the generated deploy module", async () => {
  const packageJson = await readJson("package.json");

  assert.deepEqual(packageJson.exports["./cloudflare-deploy"], {
    types: "./dist/cloudflare-deploy/index.d.ts",
    default: "./dist/cloudflare-deploy/index.js",
  });
  assert.equal(
    packageJson.exports["./cloudflare-deploy/manifest.json"],
    "./dist/cloudflare-deploy/manifest.json",
  );
});
