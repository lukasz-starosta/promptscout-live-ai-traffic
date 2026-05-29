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

export type PromptScoutCloudflareWorkerEnv = {
  PROMPTSCOUT_INGEST_TOKEN: string;
  PROMPTSCOUT_INGEST_URL: string;
  PROMPTSCOUT_QUERY_POLICY?: "keep" | "omit" | "allowlist";
  PROMPTSCOUT_QUERY_ALLOWLIST?: string;
  PROMPTSCOUT_PATH_POLICY?: "keep" | "redact";
  PROMPTSCOUT_PATH_REPLACEMENT?: string;
  PROMPTSCOUT_DEBUG?: string | boolean;
};

export type PromptScoutCloudflareWorkerContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
};

export type PromptScoutCloudflareWorkerOptions = {
  originFetch?: (request: Request) => Promise<Response>;
  ingestFetch?: LiveAiTrafficFetch;
  now?: () => Date;
  logger?: Pick<Console, "error" | "log">;
};

export async function handlePromptScoutCloudflareWorkerRequest(
  request: Request,
  env: PromptScoutCloudflareWorkerEnv,
  ctx: PromptScoutCloudflareWorkerContext,
  options: PromptScoutCloudflareWorkerOptions = {},
): Promise<Response> {
  ctx.passThroughOnException?.();

  const observation = observeCloudflareWorkerRequest(
    request,
    env,
    options,
  ).catch((error) => {
    if (isDebugEnabled(env.PROMPTSCOUT_DEBUG)) {
      (options.logger ?? console).error(
        "PromptScout Cloudflare Worker ingest failed",
        error,
      );
    }

    return {
      ok: false,
      attempts: 0,
      retryable: true,
      authFailure: false,
      error: error instanceof Error ? error : new Error(String(error)),
    } satisfies LiveAiTrafficIngestResult;
  });

  if (ctx.waitUntil === undefined) {
    void observation;
  } else {
    ctx.waitUntil(observation);
  }

  return originFetch(options)(request);
}

export async function observeCloudflareWorkerRequest(
  request: Request,
  env: PromptScoutCloudflareWorkerEnv,
  options: PromptScoutCloudflareWorkerOptions = {},
): Promise<LiveAiTrafficIngestResult> {
  const event = await createCloudflareWorkerEvent(request, env, options);
  const client = createLiveAiTrafficIngestClient({
    endpoint: env.PROMPTSCOUT_INGEST_URL,
    ingestToken: env.PROMPTSCOUT_INGEST_TOKEN,
    fetch: options.ingestFetch,
  });

  return client.send(event);
}

export async function createCloudflareWorkerEvent(
  request: Request,
  env: PromptScoutCloudflareWorkerEnv,
  options: PromptScoutCloudflareWorkerOptions = {},
): Promise<LiveAiTrafficEvent> {
  const url = new URL(request.url);
  const userAgent = optionalHeader(request.headers, "user-agent");
  const referer = optionalHeader(request.headers, "referer");
  const classification = classifyAiTraffic({
    userAgent,
    referer,
    search: url.search,
  });
  const rawEvent = parseLiveAiTrafficEvent({
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: "cloudflare",
    observedAt: (options.now?.() ?? new Date()).toISOString(),
    request: {
      host: url.host,
      path: url.pathname,
      ...(url.search.length === 0 ? {} : { search: url.search }),
      method: normalizeHttpMethod(request.method),
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(referer === undefined ? {} : { referer }),
    },
    providerClassification:
      toLiveAiTrafficProviderClassification(classification),
    ...cloudflareLocation(request),
    ipHash: {
      algorithm: "none",
      originalIpRetention: "not_collected",
    },
    integration: {
      kind: "cloudflare_worker",
      name: "cloudflare-worker",
      ...cloudflareRequestId(request),
    },
  });

  return normalizeLiveAiTrafficEvent(rawEvent, privacyOptions(env));
}

export default {
  fetch(
    request: Request,
    env: PromptScoutCloudflareWorkerEnv,
    ctx: PromptScoutCloudflareWorkerContext,
  ): Promise<Response> {
    return handlePromptScoutCloudflareWorkerRequest(request, env, ctx);
  },
};

function privacyOptions(
  env: PromptScoutCloudflareWorkerEnv,
): LiveAiTrafficPrivacyOptions {
  return {
    path:
      env.PROMPTSCOUT_PATH_POLICY === "redact"
        ? {
            mode: "redact",
            replacement: env.PROMPTSCOUT_PATH_REPLACEMENT,
          }
        : { mode: "keep" },
    query: queryPrivacyOptions(env),
    ip: { mode: "disabled" },
  };
}

function queryPrivacyOptions(
  env: PromptScoutCloudflareWorkerEnv,
): NonNullable<LiveAiTrafficPrivacyOptions["query"]> {
  if (env.PROMPTSCOUT_QUERY_POLICY === "keep") {
    return { mode: "keep" };
  }

  const allowlist = splitCsv(env.PROMPTSCOUT_QUERY_ALLOWLIST);
  if (
    env.PROMPTSCOUT_QUERY_POLICY === "allowlist" ||
    (env.PROMPTSCOUT_QUERY_POLICY === undefined && allowlist.length > 0)
  ) {
    return {
      mode: "allowlist",
      allow: allowlist,
    };
  }

  return { mode: "omit" };
}

function normalizeHttpMethod(method: string): LiveAiTrafficHttpMethod {
  switch (method.toUpperCase()) {
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

function optionalHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name);
  return value === null || value.trim().length === 0 ? undefined : value;
}

function cloudflareRequestId(
  request: Request,
): { requestId: string } | Record<string, never> {
  const requestId = optionalHeader(request.headers, "cf-ray");
  return requestId === undefined ? {} : { requestId };
}

function cloudflareLocation(
  request: Request,
): { location: { country?: string; region?: string } } | Record<string, never> {
  const cf = (request as { cf?: Record<string, unknown> }).cf;
  if (cf === undefined) {
    return {};
  }

  const country =
    typeof cf.country === "string" && /^[A-Z]{2}$/.test(cf.country)
      ? cf.country
      : undefined;
  const region =
    typeof cf.region === "string" && cf.region.trim().length > 0
      ? cf.region
      : undefined;

  if (country === undefined && region === undefined) {
    return {};
  }

  return {
    location: {
      ...(country === undefined ? {} : { country }),
      ...(region === undefined ? {} : { region }),
    },
  };
}

function originFetch(
  options: PromptScoutCloudflareWorkerOptions,
): (request: Request) => Promise<Response> {
  if (options.originFetch !== undefined) {
    return options.originFetch;
  }

  if (globalThis.fetch === undefined) {
    throw new Error("fetch is required to forward Cloudflare Worker requests");
  }

  return (request) => globalThis.fetch(request);
}

function splitCsv(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isDebugEnabled(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}
