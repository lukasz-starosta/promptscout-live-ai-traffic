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
} from "@promptscout/live-ai-traffic-core";

export type PromptScoutNetlifyEdgeEnv = {
  PROMPTSCOUT_INGEST_TOKEN: string;
  PROMPTSCOUT_INGEST_URL: string;
  PROMPTSCOUT_QUERY_POLICY?: "keep" | "omit" | "allowlist";
  PROMPTSCOUT_QUERY_ALLOWLIST?: string;
  PROMPTSCOUT_PATH_POLICY?: "keep" | "redact";
  PROMPTSCOUT_PATH_REPLACEMENT?: string;
  PROMPTSCOUT_DEBUG?: string | boolean;
};

export type PromptScoutNetlifyEdgeContext = {
  next: () => Promise<Response>;
  waitUntil?: (promise: Promise<unknown>) => void;
  requestId?: string;
  ip?: string;
  geo?: {
    country?: {
      code?: string;
      name?: string;
    };
    subdivision?: {
      code?: string;
      name?: string;
    };
  };
};

export type PromptScoutNetlifyEdgeOptions = {
  env?: PromptScoutNetlifyEdgeEnv;
  ingestFetch?: LiveAiTrafficFetch;
  now?: () => Date;
  logger?: Pick<Console, "error">;
};

type NetlifyEnvGlobal = {
  env?: {
    get(name: string): string | undefined;
  };
};

declare const Netlify: NetlifyEnvGlobal | undefined;

export async function handlePromptScoutNetlifyEdgeRequest(
  request: Request,
  context: PromptScoutNetlifyEdgeContext,
  options: PromptScoutNetlifyEdgeOptions = {},
): Promise<Response> {
  try {
    const env = options.env ?? readNetlifyEdgeEnv();
    const observation = observePromptScoutNetlifyEdgeRequest(request, context, {
      ...options,
      env,
    }).catch((error) => {
      if (isDebugEnabled(env.PROMPTSCOUT_DEBUG)) {
        (options.logger ?? console).error(
          "PromptScout Netlify Edge ingest failed",
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

    if (context.waitUntil === undefined) {
      void observation;
    } else {
      context.waitUntil(observation);
    }
  } catch (error) {
    if (isDebugEnabled(options.env?.PROMPTSCOUT_DEBUG)) {
      (options.logger ?? console).error(
        "PromptScout Netlify Edge collector setup failed",
        error,
      );
    }
  }

  return context.next();
}

export async function observePromptScoutNetlifyEdgeRequest(
  request: Request,
  context: PromptScoutNetlifyEdgeContext,
  options: PromptScoutNetlifyEdgeOptions = {},
): Promise<LiveAiTrafficIngestResult> {
  const env = options.env ?? readNetlifyEdgeEnv();
  const event = await createPromptScoutNetlifyEdgeEvent(request, context, {
    ...options,
    env,
  });
  const client = createLiveAiTrafficIngestClient({
    endpoint: env.PROMPTSCOUT_INGEST_URL,
    ingestToken: env.PROMPTSCOUT_INGEST_TOKEN,
    fetch: options.ingestFetch,
  });

  return client.send(event);
}

export async function createPromptScoutNetlifyEdgeEvent(
  request: Request,
  context: PromptScoutNetlifyEdgeContext,
  options: PromptScoutNetlifyEdgeOptions = {},
): Promise<LiveAiTrafficEvent> {
  const env = options.env ?? readNetlifyEdgeEnv();
  const url = new URL(request.url);
  const userAgent = optionalHeader(request.headers, "user-agent");
  const referer = optionalHeader(request.headers, "referer");
  const classification = classifyAiTraffic({
    userAgent,
    referer,
  });
  const rawEvent = parseLiveAiTrafficEvent({
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: "netlify",
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
    ...netlifyLocation(context),
    ipHash: {
      algorithm: "none",
      originalIpRetention: "not_collected",
    },
    integration: {
      name: "netlify-edge",
      ...netlifyRequestId(context),
    },
  });

  return normalizeLiveAiTrafficEvent(rawEvent, privacyOptions(env));
}

export function createPromptScoutNetlifyEdgeHandler(
  options: PromptScoutNetlifyEdgeOptions = {},
): (
  request: Request,
  context: PromptScoutNetlifyEdgeContext,
) => Promise<Response> {
  return (request, context) =>
    handlePromptScoutNetlifyEdgeRequest(request, context, options);
}

export default createPromptScoutNetlifyEdgeHandler;

function readNetlifyEdgeEnv(): PromptScoutNetlifyEdgeEnv {
  const netlify =
    typeof Netlify === "undefined" ? undefined : (Netlify as NetlifyEnvGlobal);
  const get = netlify?.env?.get;

  if (get === undefined) {
    throw new Error(
      "Netlify.env is required unless PromptScout Netlify Edge env options are provided",
    );
  }

  const ingestToken = get("PROMPTSCOUT_INGEST_TOKEN");
  const ingestUrl = get("PROMPTSCOUT_INGEST_URL");

  if (ingestToken === undefined || ingestToken.length === 0) {
    throw new Error("PROMPTSCOUT_INGEST_TOKEN is required");
  }

  if (ingestUrl === undefined || ingestUrl.length === 0) {
    throw new Error("PROMPTSCOUT_INGEST_URL is required");
  }

  return {
    PROMPTSCOUT_INGEST_TOKEN: ingestToken,
    PROMPTSCOUT_INGEST_URL: ingestUrl,
    ...optionalEnv(get, "PROMPTSCOUT_QUERY_POLICY"),
    ...optionalEnv(get, "PROMPTSCOUT_QUERY_ALLOWLIST"),
    ...optionalEnv(get, "PROMPTSCOUT_PATH_POLICY"),
    ...optionalEnv(get, "PROMPTSCOUT_PATH_REPLACEMENT"),
    ...optionalEnv(get, "PROMPTSCOUT_DEBUG"),
  } as PromptScoutNetlifyEdgeEnv;
}

function optionalEnv(
  get: (name: string) => string | undefined,
  name: keyof PromptScoutNetlifyEdgeEnv,
): Partial<PromptScoutNetlifyEdgeEnv> {
  const value = get(name);
  return value === undefined || value.length === 0 ? {} : { [name]: value };
}

function privacyOptions(
  env: PromptScoutNetlifyEdgeEnv,
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
  env: PromptScoutNetlifyEdgeEnv,
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

function netlifyRequestId(
  context: PromptScoutNetlifyEdgeContext,
): { requestId: string } | Record<string, never> {
  return context.requestId === undefined || context.requestId.length === 0
    ? {}
    : { requestId: context.requestId };
}

function netlifyLocation(
  context: PromptScoutNetlifyEdgeContext,
): { location: { country?: string; region?: string } } | Record<string, never> {
  const country = normalizeCountryCode(context.geo?.country?.code);
  const region = normalizeRegionCode(context.geo?.subdivision?.code);

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

function normalizeCountryCode(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizeRegionCode(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
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
