import {
  classifyAiTraffic,
  createLiveAiTrafficIngestClient,
  LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
  type LiveAiTrafficEvent,
  type LiveAiTrafficHttpMethod,
  type LiveAiTrafficIngestClient,
  type LiveAiTrafficIngestResult,
  toLiveAiTrafficProviderClassification,
} from "@promptscout/live-ai-traffic/core";

export type NginxLogFormat = "common" | "json";

export type NginxAccessLogEntry = {
  format: NginxLogFormat;
  rawLine: string;
  remoteAddress?: string;
  observedAt: string;
  host?: string;
  method: LiveAiTrafficHttpMethod;
  path: string;
  search?: string;
  protocol?: string;
  status?: number;
  bytesSent?: number;
  userAgent?: string;
  referer?: string;
};

export type NginxAccessLogParseErrorCode =
  | "empty_line"
  | "malformed_line"
  | "malformed_json"
  | "malformed_request"
  | "missing_timestamp"
  | "unsupported_format";

export type NginxAccessLogParseResult =
  | { ok: true; entry: NginxAccessLogEntry }
  | {
      ok: false;
      code: NginxAccessLogParseErrorCode;
      message: string;
      rawLine: string;
    };

export type NginxAccessLogParseOptions = {
  format?: NginxLogFormat | "auto" | string;
  defaultHost?: string;
};

export type NginxEventOptions = {
  defaultHost?: string;
  includeUnclassified?: boolean;
  query?:
    | { mode: "omit" }
    | { mode: "keep" }
    | { mode: "allowlist"; allow?: readonly string[] };
  now?: () => Date;
};

export type NginxLogCheckpoint = {
  path: string;
  fileId?: string;
  offset: number;
  updatedAt: string;
};

export type NginxLogCheckpointStore = {
  load(path: string): Promise<NginxLogCheckpoint | undefined>;
  save(checkpoint: NginxLogCheckpoint): Promise<void>;
};

export type NginxLogFileReader = {
  path: string;
  fileId?: string;
  size: number;
  readFrom(offset: number): Promise<string>;
};

export type NginxLogForwarderPassOptions = {
  file: NginxLogFileReader;
  checkpointStore: NginxLogCheckpointStore;
  client: Pick<LiveAiTrafficIngestClient, "sendBatch">;
  parse?: NginxAccessLogParseOptions;
  event?: NginxEventOptions;
  batchSize?: number;
  now?: () => Date;
};

export type NginxLogForwarderStats = {
  startOffset: number;
  completeOffset: number;
  checkpointOffset: number;
  readBytes: number;
  parsedLines: number;
  malformedLines: number;
  skippedLines: number;
  queuedEvents: number;
  sentEvents: number;
  batchesSent: number;
};

export type NginxLogForwarderPassResult =
  | { ok: true; stats: NginxLogForwarderStats }
  | {
      ok: false;
      error: "ingest_failed";
      result: LiveAiTrafficIngestResult;
      stats: NginxLogForwarderStats;
    };

export const integration = {
  provider: "nginx-log-forwarder",
  status: "available",
  notes:
    "Parses nginx access logs, batches classified AI traffic, and checkpoints byte offsets.",
} as const;
export default integration;
export { createLiveAiTrafficIngestClient };

export function parseNginxAccessLogLine(
  line: string,
  options: NginxAccessLogParseOptions = {},
): NginxAccessLogParseResult {
  const format = options.format ?? "auto";
  const trimmedLine = line.trim();

  if (trimmedLine.length === 0) {
    return parseError("empty_line", "nginx access log line is empty", line);
  }

  if (format === "json" || (format === "auto" && trimmedLine.startsWith("{"))) {
    return parseJsonLogLine(trimmedLine, line, options);
  }

  if (format === "common" || format === "auto") {
    return parseCommonLogLine(trimmedLine, line, options);
  }

  return parseError(
    "unsupported_format",
    `unsupported nginx access log format: ${format}`,
    line,
  );
}

export function createNginxLogEvent(
  entry: NginxAccessLogEntry,
  options: NginxEventOptions = {},
): LiveAiTrafficEvent {
  const classification = classifyAiTraffic({
    userAgent: entry.userAgent,
    referer: entry.referer,
    search: entry.search,
  });
  const request: LiveAiTrafficEvent["request"] = {
    host: entry.host ?? options.defaultHost ?? "unknown.local",
    path: entry.path,
    method: entry.method,
    ...optionalSearch(entry.search, options.query),
    ...(entry.userAgent === undefined ? {} : { userAgent: entry.userAgent }),
    ...(entry.referer === undefined ? {} : { referer: entry.referer }),
  };

  return {
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: "nginx_log_forwarder",
    observedAt: entry.observedAt,
    request,
    providerClassification:
      toLiveAiTrafficProviderClassification(classification),
    integration: {
      name: "nginx-log-forwarder",
    },
  };
}

function optionalSearch(
  search: string | undefined,
  options: NonNullable<NginxEventOptions["query"]> = { mode: "omit" },
): { search: string } | Record<string, never> {
  if (search === undefined || options.mode === "omit") {
    return {};
  }

  if (options.mode === "keep") {
    return { search };
  }

  const filtered = filterSearchParams(search, options.allow ?? []);
  return filtered === undefined ? {} : { search: filtered };
}

function filterSearchParams(
  search: string,
  allowlist: readonly string[],
): string | undefined {
  if (search.length === 0 || allowlist.length === 0) {
    return undefined;
  }

  const allowed = new Set(allowlist);
  const filtered = [];

  for (const part of (search.startsWith("?") ? search.slice(1) : search).split(
    "&",
  )) {
    if (part.length === 0) {
      continue;
    }

    const name = part.split("=", 1)[0];
    if (allowed.has(name)) {
      filtered.push(part);
    }
  }

  return filtered.length === 0 ? undefined : `?${filtered.join("&")}`;
}

export function shouldForwardNginxLogEvent(
  event: LiveAiTrafficEvent,
  options: Pick<NginxEventOptions, "includeUnclassified"> = {},
): boolean {
  return (
    options.includeUnclassified === true ||
    event.providerClassification.provider !== "other"
  );
}

export function serializeNginxLogCheckpoint(
  checkpoint: NginxLogCheckpoint,
): string {
  return `${JSON.stringify(checkpoint)}\n`;
}

export function parseNginxLogCheckpoint(
  input: string,
): NginxLogCheckpoint | undefined {
  try {
    const parsed = JSON.parse(input) as Partial<NginxLogCheckpoint>;
    const offset = parsed.offset;
    if (
      typeof parsed.path !== "string" ||
      typeof offset !== "number" ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      typeof parsed.updatedAt !== "string"
    ) {
      return undefined;
    }

    return {
      path: parsed.path,
      ...(typeof parsed.fileId === "string" ? { fileId: parsed.fileId } : {}),
      offset,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return undefined;
  }
}

export function createMemoryCheckpointStore(
  initial: readonly NginxLogCheckpoint[] = [],
): NginxLogCheckpointStore & { checkpoints(): NginxLogCheckpoint[] } {
  const checkpoints = new Map(
    initial.map((checkpoint) => [checkpoint.path, { ...checkpoint }]),
  );

  return {
    async load(path) {
      const checkpoint = checkpoints.get(path);
      return checkpoint === undefined ? undefined : { ...checkpoint };
    },
    async save(checkpoint) {
      checkpoints.set(checkpoint.path, { ...checkpoint });
    },
    checkpoints() {
      return [...checkpoints.values()].map((checkpoint) => ({ ...checkpoint }));
    },
  };
}

export async function runNginxLogForwarderPass(
  options: NginxLogForwarderPassOptions,
): Promise<NginxLogForwarderPassResult> {
  const now = options.now ?? options.event?.now ?? (() => new Date());
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  const storedCheckpoint = await options.checkpointStore.load(
    options.file.path,
  );
  const fileWasReplaced =
    storedCheckpoint?.fileId !== undefined &&
    options.file.fileId !== undefined &&
    storedCheckpoint.fileId !== options.file.fileId;
  const startOffset =
    storedCheckpoint === undefined ||
    storedCheckpoint.offset > options.file.size ||
    fileWasReplaced
      ? 0
      : storedCheckpoint.offset;
  const chunk = await options.file.readFrom(startOffset);
  const lines = completeLines(chunk);
  let completeOffset = startOffset;
  let checkpointOffset = startOffset;
  let batchEndOffset = startOffset;
  let batch: LiveAiTrafficEvent[] = [];
  const stats: NginxLogForwarderStats = {
    startOffset,
    completeOffset,
    checkpointOffset,
    readBytes: utf8ByteLength(chunk),
    parsedLines: 0,
    malformedLines: 0,
    skippedLines: 0,
    queuedEvents: 0,
    sentEvents: 0,
    batchesSent: 0,
  };

  const saveCheckpoint = async (offset: number): Promise<void> => {
    await options.checkpointStore.save({
      path: options.file.path,
      ...(options.file.fileId === undefined
        ? {}
        : { fileId: options.file.fileId }),
      offset,
      updatedAt: now().toISOString(),
    });
    checkpointOffset = offset;
    stats.checkpointOffset = offset;
  };

  const flush = async (
    offset: number,
  ): Promise<LiveAiTrafficIngestResult | undefined> => {
    if (batch.length === 0) {
      return undefined;
    }

    const result = await options.client.sendBatch(batch);
    if (!result.ok) {
      return result;
    }

    stats.sentEvents += batch.length;
    stats.batchesSent += 1;
    batch = [];
    await saveCheckpoint(offset);
    return undefined;
  };

  for (const segment of lines.segments) {
    const lineEndOffset = completeOffset + utf8ByteLength(segment.raw);
    completeOffset = lineEndOffset;
    stats.completeOffset = completeOffset;
    const parsed = parseNginxAccessLogLine(segment.line, options.parse);

    if (!parsed.ok) {
      stats.malformedLines += 1;
      continue;
    }

    stats.parsedLines += 1;
    const event = createNginxLogEvent(parsed.entry, options.event);
    if (!shouldForwardNginxLogEvent(event, options.event)) {
      stats.skippedLines += 1;
      continue;
    }

    batch.push(event);
    stats.queuedEvents += 1;
    batchEndOffset = lineEndOffset;

    if (batch.length >= batchSize) {
      const failure = await flush(batchEndOffset);
      if (failure !== undefined) {
        return { ok: false, error: "ingest_failed", result: failure, stats };
      }
    }
  }

  const failure = await flush(completeOffset);
  if (failure !== undefined) {
    return { ok: false, error: "ingest_failed", result: failure, stats };
  }

  if (completeOffset !== checkpointOffset) {
    await saveCheckpoint(completeOffset);
  }

  return { ok: true, stats };
}

function parseCommonLogLine(
  trimmedLine: string,
  rawLine: string,
  options: NginxAccessLogParseOptions,
): NginxAccessLogParseResult {
  const match =
    /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)]\s+"([^"]*)"\s+(\d{3}|-)\s+(\S+)(?:\s+"([^"]*)"\s+"([^"]*)")?/.exec(
      trimmedLine,
    );

  if (match === null) {
    return parseError(
      "malformed_line",
      "line does not match nginx common or combined access log format",
      rawLine,
    );
  }

  const request = parseRequest(match[3]);
  if (request === undefined) {
    return parseError(
      "malformed_request",
      "nginx request field is malformed",
      rawLine,
    );
  }

  const observedAt = parseNginxTimestamp(match[2]);
  if (observedAt === undefined) {
    return parseError(
      "missing_timestamp",
      "nginx timestamp is missing or invalid",
      rawLine,
    );
  }

  return {
    ok: true,
    entry: {
      format: "common",
      rawLine,
      remoteAddress: normalizeOptionalValue(match[1]),
      observedAt,
      host: options.defaultHost,
      method: normalizeHttpMethod(request.method),
      path: request.path,
      ...(request.search === undefined ? {} : { search: request.search }),
      protocol: request.protocol,
      status: parseOptionalInteger(match[4]),
      bytesSent: parseOptionalInteger(match[5]),
      referer: normalizeOptionalValue(match[6]),
      userAgent: normalizeOptionalValue(match[7]),
    },
  };
}

function parseJsonLogLine(
  trimmedLine: string,
  rawLine: string,
  options: NginxAccessLogParseOptions,
): NginxAccessLogParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedLine);
  } catch {
    return parseError("malformed_json", "line is not valid JSON", rawLine);
  }

  if (!isRecord(parsed)) {
    return parseError(
      "malformed_json",
      "JSON log line must be an object",
      rawLine,
    );
  }

  const request = requestFromJsonLog(parsed);
  if (request === undefined) {
    return parseError(
      "malformed_request",
      "JSON log line does not include a supported request shape",
      rawLine,
    );
  }

  const observedAt = parseJsonTimestamp(parsed);
  if (observedAt === undefined) {
    return parseError(
      "missing_timestamp",
      "JSON log line is missing a supported timestamp field",
      rawLine,
    );
  }

  return {
    ok: true,
    entry: {
      format: "json",
      rawLine,
      remoteAddress: firstString(parsed, [
        "remote_addr",
        "remoteAddress",
        "ip",
      ]),
      observedAt,
      host:
        firstString(parsed, ["host", "http_host", "server_name"]) ??
        options.defaultHost,
      method: normalizeHttpMethod(request.method),
      path: request.path,
      ...(request.search === undefined ? {} : { search: request.search }),
      protocol: request.protocol,
      status: parseOptionalInteger(
        firstValue(parsed, ["status", "status_code"]),
      ),
      bytesSent: parseOptionalInteger(
        firstValue(parsed, ["body_bytes_sent", "bytes_sent"]),
      ),
      referer: firstString(parsed, ["http_referer", "referer", "referrer"]),
      userAgent: firstString(parsed, ["http_user_agent", "user_agent"]),
    },
  };
}

function requestFromJsonLog(
  record: Record<string, unknown>,
):
  | { method: string; path: string; search?: string; protocol?: string }
  | undefined {
  const request = firstString(record, ["request"]);
  if (request !== undefined) {
    return parseRequest(request);
  }

  const method = firstString(record, ["request_method", "method"]);
  const uri = firstString(record, ["request_uri", "uri", "path"]);
  if (method === undefined || uri === undefined) {
    return undefined;
  }

  return {
    method,
    ...parseRequestTarget(uri),
    protocol: firstString(record, ["server_protocol", "protocol"]),
  };
}

function parseRequest(
  request: string | undefined,
):
  | { method: string; path: string; search?: string; protocol?: string }
  | undefined {
  if (request === undefined || request === "-" || request.trim().length === 0) {
    return undefined;
  }

  const parts = request.trim().split(/\s+/);
  if (parts.length < 2) {
    return undefined;
  }

  return {
    method: parts[0],
    ...parseRequestTarget(parts[1]),
    protocol: parts[2],
  };
}

function parseRequestTarget(target: string): { path: string; search?: string } {
  const withoutOrigin = target.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i, "");
  const pathAndQuery = withoutOrigin.length === 0 ? "/" : withoutOrigin;
  const queryIndex = pathAndQuery.indexOf("?");
  const rawPath =
    queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  const search = queryIndex === -1 ? undefined : pathAndQuery.slice(queryIndex);
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  return {
    path,
    ...(search === undefined ? {} : { search }),
  };
}

function parseNginxTimestamp(value: string): string | undefined {
  const match =
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(
      value,
    );
  if (match === null) {
    return undefined;
  }

  const month = monthNumber(match[2]);
  if (month === undefined) {
    return undefined;
  }

  const iso = `${match[3]}-${month}-${match[1]}T${match[4]}:${match[5]}:${match[6]}${match[7].slice(0, 3)}:${match[7].slice(3)}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function parseJsonTimestamp(
  record: Record<string, unknown>,
): string | undefined {
  const timestamp = firstString(record, [
    "time_iso8601",
    "timestamp",
    "time",
    "@timestamp",
  ]);
  if (timestamp !== undefined) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const msec = firstValue(record, ["msec"]);
  if (typeof msec === "string" || typeof msec === "number") {
    const date = new Date(Number(msec) * 1_000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  return undefined;
}

function normalizeHttpMethod(method: string): LiveAiTrafficHttpMethod {
  const normalized = method.toUpperCase();
  if (
    normalized === "GET" ||
    normalized === "POST" ||
    normalized === "PUT" ||
    normalized === "PATCH" ||
    normalized === "DELETE" ||
    normalized === "HEAD" ||
    normalized === "OPTIONS"
  ) {
    return normalized;
  }

  return "OTHER";
}

function parseOptionalInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string" || value === "-") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeOptionalValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "-" ? undefined : trimmed;
}

function firstString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  return normalizeOptionalValue(firstValue(record, keys));
}

function firstValue(
  record: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  return undefined;
}

function completeLines(chunk: string): {
  segments: { raw: string; line: string }[];
} {
  const segments: { raw: string; line: string }[] = [];
  let cursor = 0;

  while (cursor < chunk.length) {
    const newlineIndex = chunk.indexOf("\n", cursor);
    if (newlineIndex === -1) {
      break;
    }

    const raw = chunk.slice(cursor, newlineIndex + 1);
    segments.push({
      raw,
      line: raw.endsWith("\r\n") ? raw.slice(0, -2) : raw.slice(0, -1),
    });
    cursor = newlineIndex + 1;
  }

  return { segments };
}

function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      length += 1;
    } else if (codePoint <= 0x7ff) {
      length += 2;
    } else if (codePoint <= 0xffff) {
      length += 3;
    } else {
      length += 4;
    }
  }

  return length;
}

function parseError(
  code: NginxAccessLogParseErrorCode,
  message: string,
  rawLine: string,
): NginxAccessLogParseResult {
  return {
    ok: false,
    code,
    message,
    rawLine,
  };
}

function monthNumber(month: string): string | undefined {
  return {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  }[month];
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
