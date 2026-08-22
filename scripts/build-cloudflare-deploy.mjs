import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const deployConfig = JSON.parse(
  await readFile("packages/cloudflare-worker/deploy-config.json", "utf8"),
);
const outputDirectory = "dist/cloudflare-deploy";

const result = await build({
  entryPoints: ["packages/cloudflare-worker/src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["worker", "browser", "import", "default"],
  legalComments: "none",
  sourcemap: false,
  minify: false,
  write: false,
});

if (result.outputFiles.length !== 1) {
  throw new Error(
    `Expected one Cloudflare Worker bundle, received ${result.outputFiles.length}`,
  );
}

const script = result.outputFiles[0].text;
const sha256 = createHash("sha256").update(script).digest("hex");
const manifest = Object.freeze({
  schemaVersion: 1,
  packageName: packageJson.name,
  packageVersion: packageJson.version,
  collector: "cloudflare-worker",
  moduleType: "esm",
  mainModule: deployConfig.mainModule,
  compatibilityDate: deployConfig.compatibilityDate,
  sha256,
  byteLength: Buffer.byteLength(script),
});

await mkdir(outputDirectory, { recursive: true });
await writeFile(`${outputDirectory}/${manifest.mainModule}`, script);
await writeFile(
  `${outputDirectory}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  `${outputDirectory}/index.js`,
  [
    `export const cloudflareWorkerScript = ${JSON.stringify(script)};`,
    `export const cloudflareWorkerManifest = Object.freeze(${JSON.stringify(manifest, null, 2)});`,
    "",
  ].join("\n"),
);
await writeFile(
  `${outputDirectory}/index.d.ts`,
  `export type CloudflareWorkerDeployManifest = {\n` +
    `  readonly schemaVersion: 1;\n` +
    `  readonly packageName: string;\n` +
    `  readonly packageVersion: string;\n` +
    `  readonly collector: "cloudflare-worker";\n` +
    `  readonly moduleType: "esm";\n` +
    `  readonly mainModule: string;\n` +
    `  readonly compatibilityDate: string;\n` +
    `  readonly sha256: string;\n` +
    `  readonly byteLength: number;\n` +
    `};\n\n` +
    `export declare const cloudflareWorkerScript: string;\n` +
    `export declare const cloudflareWorkerManifest: Readonly<CloudflareWorkerDeployManifest>;\n`,
);
