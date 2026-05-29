import {
  classifyAiTraffic,
  createLiveAiTrafficIngestClient,
  LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
  type LiveAiTrafficEvent,
  type LiveAiTrafficFetch,
  type LiveAiTrafficIngestClient,
  type LiveAiTrafficPrivacyOptions,
  type LiveAiTrafficSourceProvider,
  normalizeLiveAiTrafficEvent,
  toLiveAiTrafficProviderClassification,
} from "@promptscout/live-ai-traffic/core";

declare const URL: {
  new (
    input: string,
    base?: string,
  ): {
    host: string;
    pathname: string;
    search: string;
  };
};

export type NodeHeaderValue = string | number | readonly string[] | undefined;

export type NodeHeadersLike =
  | Record<string, NodeHeaderValue>
  | {
      get(name: string): string | null | undefined;
    };

export type NodeRequestLike = {
  method?: string;
  url?: string;
  headers?: NodeHeadersLike;
  socket?: {
    remoteAddress?: string;
  };
  connection?: {
    remoteAddress?: string;
  };
};

export type ExpressRequestLike = NodeRequestLike & {
  originalUrl?: string;
  path?: string;
  query?: unknown;
  protocol?: string;
  hostname?: string;
  ip?: string;
  get?: (name: string) => string | undefined;
};

export type ExpressResponseLike = unknown;

export type ExpressNext = (error?: unknown) => void;

export type LiveAiTrafficNodePrivacyOptions =
  | LiveAiTrafficPrivacyOptions
  | ((request: NodeRequestLike) => LiveAiTrafficPrivacyOptions);

export type LiveAiTrafficNodeMiddlewareOptions = {
  client?: LiveAiTrafficIngestClient;
  endpoint?: string;
  ingestToken?: string;
  siteId?: string;
  signingSecret?: string;
  fetch?: LiveAiTrafficFetch;
  sourceProvider?: LiveAiTrafficSourceProvider;
  integrationName?: string;
  now?: () => Date;
  privacy?: LiveAiTrafficNodePrivacyOptions;
  shouldSendUnknown?: boolean;
  requestId?: (request: NodeRequestLike) => string | undefined;
  onError?: (error: Error) => void;
};

export type LiveAiTrafficNodeObserver = {
  observe(request: NodeRequestLike): Promise<LiveAiTrafficEvent | undefined>;
};

type ParsedRequestUrl = {
  host: string;
  path: string;
  search?: string;
};

const defaultSourceProvider = "node_express";
const defaultIntegrationName = "node-middleware";

export function createLiveAiTrafficNodeObserver(
  options: LiveAiTrafficNodeMiddlewareOptions,
): LiveAiTrafficNodeObserver {
  return {
    observe(request) {
      return observeLiveAiTrafficNodeRequest(request, options);
    },
  };
}

export async function observeLiveAiTrafficNodeRequest(
  request: NodeRequestLike,
  options: LiveAiTrafficNodeMiddlewareOptions,
): Promise<LiveAiTrafficEvent | undefined> {
  const event = await buildLiveAiTrafficNodeEvent(request, options);

  if (event === undefined) {
    return undefined;
  }

  await clientForOptions(options).send(event);
  return event;
}

export async function buildLiveAiTrafficNodeEvent(
  request: NodeRequestLike,
  options: LiveAiTrafficNodeMiddlewareOptions = {},
): Promise<LiveAiTrafficEvent | undefined> {
  const classification = classifyAiTraffic({
    headers: request.headers,
    userAgent: headerValue(request, "user-agent"),
    referer:
      headerValue(request, "referer") ?? headerValue(request, "referrer"),
  });

  if (!options.shouldSendUnknown && classification.provider === "other") {
    return undefined;
  }

  const parsedUrl = parseRequestUrl(request);
  const userAgent = headerValue(request, "user-agent");
  const referer =
    headerValue(request, "referer") ?? headerValue(request, "referrer");
  const requestId =
    options.requestId?.(request) ?? headerValue(request, "x-request-id");

  const event: LiveAiTrafficEvent = {
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: options.sourceProvider ?? defaultSourceProvider,
    observedAt: (options.now ?? (() => new Date()))().toISOString(),
    request: {
      host: parsedUrl.host,
      path: parsedUrl.path,
      ...(parsedUrl.search === undefined ? {} : { search: parsedUrl.search }),
      method: normalizeMethod(request.method),
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(referer === undefined ? {} : { referer }),
    },
    providerClassification:
      toLiveAiTrafficProviderClassification(classification),
    integration: {
      kind: "node_express",
      name: options.integrationName ?? defaultIntegrationName,
      ...(requestId === undefined ? {} : { requestId }),
    },
  };

  return normalizeLiveAiTrafficEvent(
    event,
    privacyForRequest(request, options),
  );
}

export function createExpressLiveAiTrafficMiddleware(
  options: LiveAiTrafficNodeMiddlewareOptions,
): (
  request: ExpressRequestLike,
  response: ExpressResponseLike,
  next: ExpressNext,
) => void {
  return (request, _response, next) => {
    void Promise.resolve()
      .then(() => observeLiveAiTrafficNodeRequest(request, options))
      .catch((error) => {
        options.onError?.(asError(error));
      });

    next();
  };
}

export function createNodeLiveAiTrafficMiddleware(
  options: LiveAiTrafficNodeMiddlewareOptions,
): (request: NodeRequestLike) => Promise<LiveAiTrafficEvent | undefined> {
  return (request) => observeLiveAiTrafficNodeRequest(request, options);
}

function clientForOptions(
  options: LiveAiTrafficNodeMiddlewareOptions,
): LiveAiTrafficIngestClient {
  if (options.client !== undefined) {
    return options.client;
  }

  return createLiveAiTrafficIngestClient({
    endpoint: options.endpoint ?? "",
    ingestToken: options.ingestToken ?? "",
    siteId: options.siteId,
    signingSecret: options.signingSecret,
    fetch: options.fetch,
  });
}

function parseRequestUrl(request: NodeRequestLike): ParsedRequestUrl {
  const host =
    headerValue(request, "host") ?? expressHostname(request) ?? "localhost";
  const protocol =
    headerValue(request, "x-forwarded-proto") ??
    expressProtocol(request) ??
    "http";
  const rawUrl = expressOriginalUrl(request) ?? request.url ?? "/";
  const url = new URL(
    rawUrl,
    `${firstCsvValue(protocol)}://${firstCsvValue(host)}`,
  );

  return {
    host: url.host,
    path: url.pathname.length === 0 ? "/" : url.pathname,
    ...(url.search.length === 0 ? {} : { search: url.search }),
  };
}

function privacyForRequest(
  request: NodeRequestLike,
  options: LiveAiTrafficNodeMiddlewareOptions,
): LiveAiTrafficPrivacyOptions {
  if (typeof options.privacy === "function") {
    return options.privacy(request);
  }

  if (options.privacy !== undefined) {
    return options.privacy;
  }

  return {
    query: { mode: "omit" },
    ip: { mode: "none", value: requestIp(request) },
  };
}

function requestIp(request: NodeRequestLike): string | undefined {
  return (
    firstCsvValue(headerValue(request, "x-forwarded-for")) ??
    expressIp(request) ??
    request.socket?.remoteAddress ??
    request.connection?.remoteAddress
  );
}

function headerValue(
  request: NodeRequestLike,
  name: string,
): string | undefined {
  const headers = request.headers;
  const expressValue = expressHeader(request, name);

  if (expressValue !== undefined) {
    return expressValue;
  }

  if (headers === undefined) {
    return undefined;
  }

  if ("get" in headers && typeof headers.get === "function") {
    return normalizeHeaderValue(headers.get(name));
  }

  const lowerName = name.toLowerCase();
  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() === lowerName) {
      return normalizeHeaderValue(value);
    }
  }

  return undefined;
}

function normalizeHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeHeaderValue(item);
      if (normalized !== undefined) {
        return normalized;
      }
    }

    return undefined;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeMethod(
  method: string | undefined,
): LiveAiTrafficEvent["request"]["method"] {
  const normalized = method?.toUpperCase();

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

function firstCsvValue(value: string | undefined): string | undefined {
  return value?.split(",", 1)[0]?.trim();
}

function expressHeader(
  request: NodeRequestLike,
  name: string,
): string | undefined {
  const getter = (request as ExpressRequestLike).get;
  if (typeof getter !== "function") {
    return undefined;
  }

  return normalizeHeaderValue(getter.call(request, name));
}

function expressOriginalUrl(request: NodeRequestLike): string | undefined {
  return normalizeHeaderValue((request as ExpressRequestLike).originalUrl);
}

function expressProtocol(request: NodeRequestLike): string | undefined {
  return normalizeHeaderValue((request as ExpressRequestLike).protocol);
}

function expressHostname(request: NodeRequestLike): string | undefined {
  return normalizeHeaderValue((request as ExpressRequestLike).hostname);
}

function expressIp(request: NodeRequestLike): string | undefined {
  return normalizeHeaderValue((request as ExpressRequestLike).ip);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
