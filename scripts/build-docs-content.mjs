import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(repoRoot, "docs-manifest.json");
const outputDirectory = join(repoRoot, "dist");
const guidePathPattern = /^docs\/integrations\/[a-z0-9-]+\.md$/u;
const guideIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function escapeJavaScriptJson(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function assertManifest(manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.packageName !== "@promptscout/live-ai-traffic" ||
    !Array.isArray(manifest.guides)
  ) {
    throw new Error("docs-manifest.json has an unsupported shape");
  }
}

async function buildDocsContent() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assertManifest(manifest);

  const seenGuideIds = new Set();
  const guides = await Promise.all(
    manifest.guides.map(async (guide) => {
      if (!guideIdPattern.test(guide.id) || seenGuideIds.has(guide.id)) {
        throw new Error(`Invalid or duplicate guide id: ${guide.id}`);
      }
      if (!guidePathPattern.test(guide.markdownPath)) {
        throw new Error(`Invalid guide markdown path: ${guide.markdownPath}`);
      }

      seenGuideIds.add(guide.id);
      return {
        ...guide,
        markdown: await readFile(join(repoRoot, guide.markdownPath), "utf8"),
      };
    }),
  );

  const docsContent = {
    ...manifest,
    guides,
  };
  const guideIdType = guides
    .map((guide) => JSON.stringify(guide.id))
    .join(" | ");

  const moduleSource = `export const liveAiTrafficDocs = ${escapeJavaScriptJson(docsContent)};\n\nexport default liveAiTrafficDocs;\n`;
  const declarationSource = `export type LiveAiTrafficGuideId = ${guideIdType};

export type LiveAiTrafficGuideSupportStatus =
  | "current"
  | "placeholder"
  | "preview";

export type LiveAiTrafficDocsGuide = {
  readonly id: LiveAiTrafficGuideId;
  readonly markdown: string;
  readonly markdownPath: string;
  readonly order: number;
  readonly packageExports: readonly string[];
  readonly packageName: string;
  readonly platform: string;
  readonly runtime: string;
  readonly shortDescription: string;
  readonly supportStatus: LiveAiTrafficGuideSupportStatus;
  readonly title: string;
  readonly tokenEnvVar?: string;
};

export type LiveAiTrafficDocsContent = {
  readonly betaNotice: string;
  readonly guides: readonly LiveAiTrafficDocsGuide[];
  readonly packageName: "@promptscout/live-ai-traffic";
  readonly schemaVersion: 1;
};

export declare const liveAiTrafficDocs: LiveAiTrafficDocsContent;

export default liveAiTrafficDocs;
`;

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "docs-content.js"), moduleSource),
    writeFile(join(outputDirectory, "docs-content.d.ts"), declarationSource),
  ]);
}

await buildDocsContent();
