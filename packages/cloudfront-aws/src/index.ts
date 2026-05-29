import {
  classifyAiTraffic,
  createLiveAiTrafficIngestClient,
  LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
  type LiveAiTrafficEvent,
  type LiveAiTrafficFetch,
  type LiveAiTrafficHttpMethod,
  type LiveAiTrafficIngestResult,
  type LiveAiTrafficPrivacyOptions,
  normalizeLiveAiTrafficEvent,
  parseLiveAiTrafficEvent,
  toLiveAiTrafficProviderClassification,
} from "@promptscout/live-ai-traffic/core";

declare const Buffer: {
  from(
    input: string,
    encoding: "base64",
  ): {
    toString(encoding: "utf8"): string;
  };
};

export type CloudFrontRealtimeLogField =
  | "timestamp"
  | "c-ip"
  | "sc-status"
  | "cs-method"
  | "cs-protocol"
  | "cs-host"
  | "cs-uri-stem"
  | "x-edge-request-id"
  | "cs-user-agent"
  | "cs-referer"
  | "cs-uri-query"
  | "c-country"
  | "x-host-header";

export type CloudFrontRealtimeLogRecord = Partial<
  Record<CloudFrontRealtimeLogField, string>
>;

export type CloudFrontRealtimeLogParseOptions = {
  fields?: readonly CloudFrontRealtimeLogField[];
};

export type BuildPromptScoutCloudFrontAwsEventOptions =
  CloudFrontRealtimeLogParseOptions & {
    privacy?: LiveAiTrafficPrivacyOptions;
  };

export type PromptScoutCloudFrontAwsEnv = {
  PROMPTSCOUT_INGEST_URL: string;
  PROMPTSCOUT_INGEST_TOKEN: string;
  PROMPTSCOUT_SITE_ID?: string;
};

export type PromptScoutCloudFrontAwsKinesisHandlerOptions =
  BuildPromptScoutCloudFrontAwsEventOptions & {
    fetch?: LiveAiTrafficFetch;
  };

export type PromptScoutCloudFrontAwsKinesisEvent = {
  Records: readonly {
    kinesis?: {
      data?: unknown;
    };
  }[];
};

export const cloudFrontAwsImplementationDecision = {
  selectedPath: "cloudfront-realtime-logs-kinesis",
  note: "Use CloudFront real-time access logs delivered to Kinesis Data Streams, then run a regional Lambda or Kinesis consumer that forwards normalized PromptScout live AI traffic events.",
  unsupportedPaths: [
    "CloudFront Functions cannot POST to PromptScout because the runtime has no network access.",
    "Lambda@Edge remains a fallback only when its regional, versioning, environment, and concurrency limits are acceptable.",
  ],
} as const;

export const recommendedCloudFrontRealtimeLogFields = [
  "timestamp",
  "c-ip",
  "sc-status",
  "cs-method",
  "cs-protocol",
  "cs-host",
  "cs-uri-stem",
  "x-edge-request-id",
  "cs-user-agent",
  "cs-referer",
  "cs-uri-query",
  "c-country",
] as const satisfies readonly CloudFrontRealtimeLogField[];

export function parseCloudFrontRealtimeLogRecord(
  record: string,
  options: CloudFrontRealtimeLogParseOptions = {},
): CloudFrontRealtimeLogRecord {
  const fields = options.fields ?? recommendedCloudFrontRealtimeLogFields;
  const line = record.replace(/\r?\n$/, "");

  if (line.trim().length === 0) {
    throw new Error("CloudFront real-time log record must not be empty");
  }

  const values = line.split("\t");
  if (values.length !== fields.length) {
    throw new Error(
      `Expected ${fields.length} CloudFront real-time log fields, received ${values.length}`,
    );
  }

  const parsed: CloudFrontRealtimeLogRecord = {};
  for (let index = 0; index < fields.length; index += 1) {
    const value = normalizeLogValue(values[index]);
    if (value !== undefined) {
      parsed[fields[index]] = value;
    }
  }

  return parsed;
}

export async function buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord(
  record: string | CloudFrontRealtimeLogRecord,
  options: BuildPromptScoutCloudFrontAwsEventOptions = {},
): Promise<LiveAiTrafficEvent> {
  const parsed =
    typeof record === "string"
      ? parseCloudFrontRealtimeLogRecord(record, options)
      : record;
  const userAgent = parsed["cs-user-agent"];
  const referer = parsed["cs-referer"];
  const requestUrl = requestUrlParts(parsed);
  const classification = classifyAiTraffic({
    userAgent,
    referer,
    search: requestUrl.search,
  });
  const rawEvent = parseLiveAiTrafficEvent({
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: "cloudfront_aws",
    observedAt: isoDateTime(parsed.timestamp, "timestamp"),
    request: {
      host: requiredLogValue(parsed, "cs-host", "x-host-header"),
      path: requestUrl.path,
      ...(requestUrl.search === undefined ? {} : { search: requestUrl.search }),
      method: normalizeHttpMethod(parsed["cs-method"]),
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(referer === undefined ? {} : { referer }),
    },
    providerClassification:
      toLiveAiTrafficProviderClassification(classification),
    ...(countryLocation(parsed["c-country"]) === undefined
      ? {}
      : { location: countryLocation(parsed["c-country"]) }),
    ipHash: {
      algorithm: "none",
      originalIpRetention: "not_collected",
    },
    integration: {
      name: "cloudfront-aws-realtime-logs",
      ...(parsed["x-edge-request-id"] === undefined
        ? {}
        : { requestId: parsed["x-edge-request-id"] }),
    },
  });

  return normalizeLiveAiTrafficEvent(rawEvent, {
    query: { mode: "omit" },
    ...options.privacy,
    ip: normalizeIpPrivacy(options.privacy?.ip, parsed["c-ip"]),
  });
}

export async function buildPromptScoutCloudFrontAwsEventsFromKinesisEvent(
  event: unknown,
  options: BuildPromptScoutCloudFrontAwsEventOptions = {},
): Promise<LiveAiTrafficEvent[]> {
  const records = kinesisRecords(event);
  const events: LiveAiTrafficEvent[] = [];

  for (const record of records) {
    const decoded = decodeKinesisData(record.kinesis?.data);
    for (const line of decoded.split(/\r?\n/)) {
      if (line.trim().length === 0) {
        continue;
      }

      events.push(
        await buildPromptScoutCloudFrontAwsEventFromRealtimeLogRecord(
          line,
          options,
        ),
      );
    }
  }

  return events;
}

export async function handlePromptScoutCloudFrontAwsKinesisEvent(
  event: unknown,
  env: PromptScoutCloudFrontAwsEnv,
  options: PromptScoutCloudFrontAwsKinesisHandlerOptions = {},
): Promise<LiveAiTrafficIngestResult> {
  const events = await buildPromptScoutCloudFrontAwsEventsFromKinesisEvent(
    event,
    options,
  );
  const client = createLiveAiTrafficIngestClient({
    endpoint: env.PROMPTSCOUT_INGEST_URL,
    ingestToken: env.PROMPTSCOUT_INGEST_TOKEN,
    siteId: env.PROMPTSCOUT_SITE_ID,
    fetch: options.fetch,
  });

  return client.sendBatch(events);
}

function requestUrlParts(record: CloudFrontRealtimeLogRecord): {
  path: string;
  search?: string;
} {
  const uriStem = requiredLogValue(record, "cs-uri-stem");
  const [path, embeddedQuery = ""] = uriStem.split("?", 2);
  const rawQuery = record["cs-uri-query"] ?? embeddedQuery;
  const search = normalizeSearch(rawQuery);

  return {
    path: path.length === 0 ? "/" : path,
    ...(search === undefined ? {} : { search }),
  };
}

function kinesisRecords(
  event: unknown,
): PromptScoutCloudFrontAwsKinesisEvent["Records"] {
  if (!isRecord(event) || !Array.isArray(event.Records)) {
    throw new Error("Kinesis event must contain a Records array");
  }

  return event.Records as PromptScoutCloudFrontAwsKinesisEvent["Records"];
}

function decodeKinesisData(data: unknown): string {
  if (typeof data !== "string") {
    throw new Error("Kinesis record data must be a base64 string");
  }

  return Buffer.from(data, "base64").toString("utf8");
}

function normalizeIpPrivacy(
  ip: LiveAiTrafficPrivacyOptions["ip"] | undefined,
  clientIp: string | undefined,
): LiveAiTrafficPrivacyOptions["ip"] {
  if (ip === undefined) {
    return { mode: "disabled" };
  }

  if (ip.mode === "hash") {
    return {
      ...ip,
      value: ip.value ?? clientIp,
    };
  }

  return ip;
}

function isoDateTime(value: string | undefined, field: string): string {
  if (value === undefined) {
    throw new Error(`CloudFront real-time log field ${field} is required`);
  }

  const date = /^\d+(?:\.\d+)?$/.test(value)
    ? new Date(Number(value) * 1000)
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`CloudFront real-time log field ${field} must be a date`);
  }

  return date.toISOString();
}

function requiredLogValue(
  record: CloudFrontRealtimeLogRecord,
  ...fields: readonly CloudFrontRealtimeLogField[]
): string {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value.trim().length > 0) {
      return value;
    }
  }

  throw new Error(
    `CloudFront real-time log field ${fields.join(" or ")} is required`,
  );
}

function normalizeLogValue(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value === "-") {
    return undefined;
  }

  return value;
}

function normalizeSearch(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value === "-") {
    return undefined;
  }

  return value.startsWith("?") ? value : `?${value}`;
}

function normalizeHttpMethod(
  method: string | undefined,
): LiveAiTrafficHttpMethod {
  switch (method?.toUpperCase()) {
    case "GET":
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
    case "HEAD":
    case "OPTIONS":
      return method.toUpperCase() as LiveAiTrafficHttpMethod;
    default:
      return "OTHER";
  }
}

function countryLocation(
  country: string | undefined,
): { country: string } | undefined {
  if (country === undefined || !/^[A-Z]{2}$/.test(country)) {
    return undefined;
  }

  return { country };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
