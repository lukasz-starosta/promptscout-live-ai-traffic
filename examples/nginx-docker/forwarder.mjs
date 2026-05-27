import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createLiveAiTrafficIngestClient,
  parseNginxLogCheckpoint,
  runNginxLogForwarderPass,
  serializeNginxLogCheckpoint,
} from "@lukasz-starosta/promptscout-live-ai-traffic-nginx-log-forwarder";

const endpoint =
  process.env.PROMPTSCOUT_INGEST_ENDPOINT ??
  "http://localhost:8787/ingest/live-ai-traffic";
const ingestToken = process.env.PROMPTSCOUT_INGEST_TOKEN ?? "local-dev-token";
const logPath =
  process.env.NGINX_ACCESS_LOG_PATH ?? "/var/log/nginx/access.log";
const checkpointPath =
  process.env.NGINX_CHECKPOINT_PATH ??
  "/state/nginx-log-forwarder.checkpoint.json";
const batchSize = Number.parseInt(
  process.env.NGINX_FORWARDER_BATCH_SIZE ?? "25",
  10,
);
const intervalMs = Number.parseInt(
  process.env.NGINX_FORWARDER_INTERVAL_MS ?? "1000",
  10,
);

const client = createLiveAiTrafficIngestClient({
  endpoint,
  ingestToken,
});

const checkpointStore = {
  async load(path) {
    try {
      const checkpoint = parseNginxLogCheckpoint(
        await readFile(checkpointPath, "utf8"),
      );
      return checkpoint?.path === path ? checkpoint : undefined;
    } catch {
      return undefined;
    }
  },
  async save(checkpoint) {
    await mkdir(dirname(checkpointPath), { recursive: true });
    await writeFile(checkpointPath, serializeNginxLogCheckpoint(checkpoint));
  },
};

async function fileReader() {
  const details = await stat(logPath);

  return {
    path: logPath,
    fileId: `${details.dev}:${details.ino}`,
    size: details.size,
    async readFrom(offset) {
      const content = await readFile(logPath);
      return content.subarray(offset).toString("utf8");
    },
  };
}

async function tick() {
  const result = await runNginxLogForwarderPass({
    file: await fileReader(),
    checkpointStore,
    client,
    parse: { format: "json", defaultHost: "localhost:8088" },
    event: { defaultHost: "localhost:8088" },
    batchSize,
  });

  if (!result.ok) {
    console.error("nginx forwarder ingest failed", result.result);
    return;
  }

  if (result.stats.sentEvents > 0 || result.stats.malformedLines > 0) {
    console.log("nginx forwarder pass", result.stats);
  }
}

async function main() {
  console.log("nginx forwarder watching", logPath);
  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error("nginx forwarder pass failed", error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

await main();
