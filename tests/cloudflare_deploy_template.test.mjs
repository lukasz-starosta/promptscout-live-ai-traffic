import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("the Cloudflare dashboard template is an isolated deployable project", async () => {
  const [templatePackage, source, config, exampleSecrets, readme] =
    await Promise.all([
      readJson("templates/cloudflare-worker/package.json"),
      read("templates/cloudflare-worker/src/index.js"),
      read("templates/cloudflare-worker/wrangler.jsonc"),
      read("templates/cloudflare-worker/.dev.vars.example"),
      read("README.md"),
    ]);

  assert.equal(
    templatePackage.dependencies["@promptscout/live-ai-traffic"],
    "0.3.1",
  );
  assert.equal(
    templatePackage.dependencies["@promptscout/live-ai-traffic"].includes(
      "workspace:",
    ),
    false,
  );
  assert.match(source, /@promptscout\/live-ai-traffic\/cloudflare-worker/);
  assert.match(config, /"main": "src\/index\.js"/);
  assert.doesNotMatch(config, /"routes?"/);
  assert.match(exampleSecrets, /^PROMPTSCOUT_INGEST_TOKEN=$/m);
  assert.match(exampleSecrets, /^PROMPTSCOUT_INGEST_URL=$/m);
  assert.match(
    readme,
    /deploy\.workers\.cloudflare\.com\/\?url=.*templates\/cloudflare-worker/,
  );
});
