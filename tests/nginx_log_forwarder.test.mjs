import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

let nginxModulePromise;

async function nginxModule() {
  if (!nginxModulePromise) {
    execFileSync("yarn", ["tsc", "-b", "packages/nginx-log-forwarder"], {
      env: { ...process.env, YARN_ENABLE_NETWORK: "0" },
      stdio: "inherit",
    });
    nginxModulePromise = import(
      "../packages/nginx-log-forwarder/dist/index.js"
    );
  }

  return nginxModulePromise;
}

async function fixtureLines(path) {
  const text = await readFile(path, "utf8");
  return text.trimEnd().split("\n");
}

function response(status, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

describe("nginx access log parser", () => {
  it("parses common log fixtures for OpenAI, Claude, Perplexity, and browser traffic", async () => {
    const {
      createNginxLogEvent,
      parseNginxAccessLogLine,
      shouldForwardNginxLogEvent,
    } = await nginxModule();
    const lines = await fixtureLines(
      "packages/nginx-log-forwarder/fixtures/common-access.log",
    );
    const providers = [];
    const forwardable = [];

    for (const line of lines) {
      const parsed = parseNginxAccessLogLine(line, {
        format: "common",
        defaultHost: "example.com",
      });
      assert.equal(parsed.ok, true, line);
      const event = createNginxLogEvent(parsed.entry);
      providers.push(event.providerClassification.provider);
      forwardable.push(shouldForwardNginxLogEvent(event));
    }

    assert.deepEqual(providers, [
      "openai_search_bot",
      "anthropic_claudebot",
      "perplexitybot",
      "other",
    ]);
    assert.deepEqual(forwardable, [true, true, true, false]);
  });

  it("parses JSON log fixtures and flexible nginx field names", async () => {
    const { createNginxLogEvent, parseNginxAccessLogLine } =
      await nginxModule();
    const lines = await fixtureLines(
      "packages/nginx-log-forwarder/fixtures/json-access.log",
    );
    const events = lines.map((line) => {
      const parsed = parseNginxAccessLogLine(line, { format: "json" });
      assert.equal(parsed.ok, true, line);
      return createNginxLogEvent(parsed.entry);
    });

    assert.deepEqual(
      events.map((event) => event.providerClassification.provider),
      [
        "openai_chatgpt_user",
        "anthropic_claude_user",
        "perplexity_user",
        "other",
      ],
    );
    assert.equal(events[1].request.path, "/claude");
    assert.equal(events[1].request.search, undefined);
    assert.equal(events[1].request.host, "example.com");
  });

  it("omits nginx query strings by default and keeps them only when configured", async () => {
    const { createNginxLogEvent, parseNginxAccessLogLine } =
      await nginxModule();
    const parsed = parseNginxAccessLogLine(
      '203.0.113.10 - - [26/May/2026:12:00:00 +0000] "GET /docs?source=openai&token=secret HTTP/1.1" 200 512 "-" "OAI-SearchBot/1.0; +https://openai.com/searchbot"',
      { format: "common", defaultHost: "example.com" },
    );
    assert.equal(parsed.ok, true);

    assert.equal(createNginxLogEvent(parsed.entry).request.search, undefined);
    assert.equal(
      createNginxLogEvent(parsed.entry, { query: { mode: "keep" } }).request
        .search,
      "?source=openai&token=secret",
    );
    assert.equal(
      createNginxLogEvent(parsed.entry, {
        query: { mode: "allowlist", allow: ["source"] },
      }).request.search,
      "?source=openai",
    );
  });

  it("reports malformed lines and unsupported formats without throwing", async () => {
    const { parseNginxAccessLogLine } = await nginxModule();
    const lines = await fixtureLines(
      "packages/nginx-log-forwarder/fixtures/malformed-access.log",
    );

    assert.deepEqual(
      lines.map((line) => parseNginxAccessLogLine(line).code),
      ["malformed_line", "malformed_request", "missing_timestamp"],
    );
    assert.deepEqual(parseNginxAccessLogLine("{}", { format: "xml" }), {
      ok: false,
      code: "unsupported_format",
      message: "unsupported nginx access log format: xml",
      rawLine: "{}",
    });
  });
});

describe("nginx log forwarder", () => {
  it("batches classified AI events and stores checkpoints after successful sends", async () => {
    const {
      createMemoryCheckpointStore,
      runNginxLogForwarderPass,
      serializeNginxLogCheckpoint,
      parseNginxLogCheckpoint,
    } = await nginxModule();
    const path = "access.log";
    const text = await readFile(
      "packages/nginx-log-forwarder/fixtures/common-access.log",
      "utf8",
    );
    const sentBatches = [];
    const checkpointStore = createMemoryCheckpointStore();
    const client = {
      async sendBatch(events) {
        sentBatches.push(events);
        return response(202);
      },
    };
    const file = {
      path,
      size: Buffer.byteLength(text),
      async readFrom(offset) {
        return text.slice(offset);
      },
    };

    const result = await runNginxLogForwarderPass({
      file,
      checkpointStore,
      client,
      parse: { format: "common", defaultHost: "example.com" },
      batchSize: 2,
      now: () => new Date("2026-05-26T12:30:00.000Z"),
    });

    assert.equal(result.ok, true);
    assert.equal(result.stats.parsedLines, 4);
    assert.equal(result.stats.queuedEvents, 3);
    assert.equal(result.stats.sentEvents, 3);
    assert.equal(result.stats.batchesSent, 2);
    assert.deepEqual(
      sentBatches.map((batch) => batch.length),
      [2, 1],
    );
    assert.equal(result.stats.checkpointOffset, Buffer.byteLength(text));

    const [checkpoint] = checkpointStore.checkpoints();
    assert.deepEqual(
      parseNginxLogCheckpoint(serializeNginxLogCheckpoint(checkpoint)),
      {
        path,
        offset: Buffer.byteLength(text),
        updatedAt: "2026-05-26T12:30:00.000Z",
      },
    );

    const secondRun = await runNginxLogForwarderPass({
      file,
      checkpointStore,
      client,
      parse: { format: "common", defaultHost: "example.com" },
      batchSize: 2,
    });

    assert.equal(secondRun.ok, true);
    assert.equal(secondRun.stats.readBytes, 0);
    assert.equal(sentBatches.length, 2);
  });

  it("leaves the checkpoint at the last successful batch when retries are exhausted", async () => {
    const { createMemoryCheckpointStore, runNginxLogForwarderPass } =
      await nginxModule();
    const path = "access.log";
    const text = await readFile(
      "packages/nginx-log-forwarder/fixtures/common-access.log",
      "utf8",
    );
    const checkpointStore = createMemoryCheckpointStore();
    let attempts = 0;
    const client = {
      async sendBatch() {
        attempts += 1;
        return attempts === 1 ? response(202) : response(503, "try again");
      },
    };
    const file = {
      path,
      size: Buffer.byteLength(text),
      async readFrom(offset) {
        return text.slice(offset);
      },
    };

    const result = await runNginxLogForwarderPass({
      file,
      checkpointStore,
      client,
      parse: { format: "common", defaultHost: "example.com" },
      batchSize: 2,
      now: () => new Date("2026-05-26T12:45:00.000Z"),
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "ingest_failed");
    assert.equal(result.stats.sentEvents, 2);
    assert.equal(result.stats.queuedEvents, 3);
    assert.equal(checkpointStore.checkpoints().length, 1);
    assert.ok(
      checkpointStore.checkpoints()[0].offset < Buffer.byteLength(text),
    );
  });

  it("resets the offset when log rotation replaces the file with a larger one", async () => {
    const { createMemoryCheckpointStore, runNginxLogForwarderPass } =
      await nginxModule();
    const path = "access.log";
    const oldText =
      '203.0.113.1 - - [26/May/2026:11:59:00 +0000] "GET /old HTTP/1.1" 200 256 "-" "GPTBot/1.0"\n';
    const newText = [
      '203.0.113.2 - - [26/May/2026:12:00:00 +0000] "GET /new HTTP/1.1" 200 512 "-" "GPTBot/1.0"',
      '203.0.113.3 - - [26/May/2026:12:01:00 +0000] "GET /pricing HTTP/1.1" 200 1024 "-" "ChatGPT-User/1.0"',
      '203.0.113.4 - - [26/May/2026:12:02:00 +0000] "GET /docs HTTP/1.1" 200 2048 "-" "Mozilla/5.0"',
    ].join("\n");
    const rotatedText = `${newText}\n`;
    assert.ok(Buffer.byteLength(rotatedText) > Buffer.byteLength(oldText));

    const checkpointStore = createMemoryCheckpointStore([
      {
        path,
        fileId: "old-device:old-inode",
        offset: Buffer.byteLength(oldText),
        updatedAt: "2026-05-26T11:59:00.000Z",
      },
    ]);
    const readOffsets = [];
    const sentBatches = [];
    const client = {
      async sendBatch(events) {
        sentBatches.push(events);
        return response(202);
      },
    };

    const result = await runNginxLogForwarderPass({
      file: {
        path,
        fileId: "new-device:new-inode",
        size: Buffer.byteLength(rotatedText),
        async readFrom(offset) {
          readOffsets.push(offset);
          return rotatedText.slice(offset);
        },
      },
      checkpointStore,
      client,
      parse: { format: "common", defaultHost: "example.com" },
      batchSize: 10,
      now: () => new Date("2026-05-26T12:05:00.000Z"),
    });

    assert.equal(result.ok, true);
    assert.equal(result.stats.startOffset, 0);
    assert.deepEqual(readOffsets, [0]);
    assert.equal(result.stats.parsedLines, 3);
    assert.equal(result.stats.queuedEvents, 2);
    assert.equal(sentBatches.length, 1);
    assert.equal(
      checkpointStore.checkpoints()[0].fileId,
      "new-device:new-inode",
    );
    assert.equal(
      checkpointStore.checkpoints()[0].offset,
      Buffer.byteLength(rotatedText),
    );
  });

  it("does not advance past an incomplete trailing line", async () => {
    const { createMemoryCheckpointStore, runNginxLogForwarderPass } =
      await nginxModule();
    const completeLine =
      '203.0.113.10 - - [26/May/2026:12:00:00 +0000] "GET /docs HTTP/1.1" 200 512 "-" "GPTBot/1.0"\n';
    const partialLine =
      '203.0.113.11 - - [26/May/2026:12:01:00 +0000] "GET /pricing HTTP/1.1" 200';
    const text = `${completeLine}${partialLine}`;
    const checkpointStore = createMemoryCheckpointStore();
    const client = {
      async sendBatch() {
        return response(202);
      },
    };

    const result = await runNginxLogForwarderPass({
      file: {
        path: "access.log",
        size: Buffer.byteLength(text),
        async readFrom(offset) {
          return text.slice(offset);
        },
      },
      checkpointStore,
      client,
      parse: { format: "common", defaultHost: "example.com" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.stats.parsedLines, 1);
    assert.equal(
      result.stats.checkpointOffset,
      Buffer.byteLength(completeLine),
    );
  });
});
