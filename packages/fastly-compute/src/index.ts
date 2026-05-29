import {
  classifyAiTraffic,
  createLiveAiTrafficIngestClient,
  LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
  type LiveAiTrafficEvent,
  type LiveAiTrafficFetchInit,
  type LiveAiTrafficIngestResult,
  type LiveAiTrafficRetryOptions,
  normalizeLiveAiTrafficEvent,
  toLiveAiTrafficProviderClassification,
} from "@promptscout/live-ai-traffic/core";

export type FastlyComputeHeadersLike =
  | {
      get(name: string): string | null;
    }
  | Record<string, string | undefined>;

export type FastlyComputeRequestLike = {
  url: string;
  method: string;
  headers: FastlyComputeHeadersLike;
};

export type FastlyComputeFetchInit = Partial<LiveAiTrafficFetchInit> & {
  backend: string;
};

export type FastlyComputeFetch<TResponse = unknown> = (
  resource: string | FastlyComputeRequestLike,
  init?: FastlyComputeFetchInit,
) => Promise<TResponse>;

export type FastlyComputeRequestMetadata = {
  now?: () => Date;
  country?: string;
  region?: string;
  requestId?: string;
};

export type FastlyComputeCollectorOptions<TResponse = unknown> = {
  originBackend: string;
  ingestBackend: string;
  ingestEndpoint: string;
  ingestToken: string;
  siteId?: string;
  signingSecret?: string;
  fetch?: FastlyComputeFetch<TResponse>;
  retry?: LiveAiTrafficRetryOptions;
  now?: () => Date;
};

export type FastlyComputeFetchEventLike = FastlyComputeRequestMetadata & {
  request: FastlyComputeRequestLike;
  waitUntil?: (promise: Promise<LiveAiTrafficIngestResult>) => void;
};

type ParsedUrl = {
  host: string;
  pathname: string;
  search: string;
};

type URLConstructorLike = new (input: string) => ParsedUrl;

const httpMethods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export function normalizeFastlyComputeRequest(
  request: FastlyComputeRequestLike,
  metadata: FastlyComputeRequestMetadata = {},
): LiveAiTrafficEvent {
  const parsedUrl = parseRequestUrl(request.url);
  const userAgent = headerValue(request.headers, "user-agent");
  const referer =
    headerValue(request.headers, "referer") ??
    headerValue(request.headers, "referrer");
  const classification = classifyAiTraffic({
    userAgent,
    referer,
    headers: request.headers,
  });
  const event: LiveAiTrafficEvent = {
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: "fastly",
    observedAt: (metadata.now ?? defaultNow)().toISOString(),
    request: {
      host: parsedUrl.host,
      path: parsedUrl.pathname || "/",
      method: normalizeHttpMethod(request.method),
      ...(parsedUrl.search === "" ? {} : { search: parsedUrl.search }),
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(referer === undefined ? {} : { referer }),
    },
    providerClassification:
      toLiveAiTrafficProviderClassification(classification),
    integration: {
      kind: "fastly_compute",
      name: "fastly-compute",
      ...(metadata.requestId === undefined
        ? {}
        : { requestId: metadata.requestId }),
    },
  };

  if (metadata.country !== undefined || metadata.region !== undefined) {
    event.location = {
      ...(metadata.country === undefined ? {} : { country: metadata.country }),
      ...(metadata.region === undefined ? {} : { region: metadata.region }),
    };
  }

  return event;
}

export function createFastlyComputeHandler<TResponse = unknown>(
  options: FastlyComputeCollectorOptions<TResponse>,
): (event: FastlyComputeFetchEventLike) => Promise<TResponse> {
  const fetch = options.fetch ?? defaultFastlyFetch<TResponse>();
  const ingestClient = createLiveAiTrafficIngestClient({
    endpoint: options.ingestEndpoint,
    ingestToken: options.ingestToken,
    ...(options.siteId === undefined ? {} : { siteId: options.siteId }),
    ...(options.signingSecret === undefined
      ? {}
      : { signingSecret: options.signingSecret }),
    fetch: async (url, init) =>
      (await fetch(url, {
        ...init,
        backend: options.ingestBackend,
      })) as unknown as {
        ok: boolean;
        status: number;
        text?: () => Promise<string>;
      },
    ...(options.retry === undefined ? {} : { retry: options.retry }),
    now: options.now,
  });

  return async (event) => {
    const ingestPromise = normalizeLiveAiTrafficEvent(
      normalizeFastlyComputeRequest(event.request, {
        now: options.now,
        country: event.country,
        region: event.region,
        requestId: event.requestId,
      }),
      { query: { mode: "omit" } },
    ).then((normalizedEvent) => ingestClient.send(normalizedEvent));

    if (event.waitUntil === undefined) {
      void ingestPromise.catch(() => undefined);
    } else {
      event.waitUntil(ingestPromise);
    }

    return fetch(event.request, { backend: options.originBackend });
  };
}

function defaultNow(): Date {
  return new Date();
}

function normalizeHttpMethod(
  method: string,
): LiveAiTrafficEvent["request"]["method"] {
  const upperMethod = method.toUpperCase();

  return httpMethods.has(upperMethod)
    ? (upperMethod as LiveAiTrafficEvent["request"]["method"])
    : "OTHER";
}

function headerValue(
  headers: FastlyComputeHeadersLike,
  name: string,
): string | undefined {
  const value = hasHeaderGetter(headers)
    ? headers.get(name)
    : (headers[name] ?? headers[name.toLowerCase()]);

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function hasHeaderGetter(
  headers: FastlyComputeHeadersLike,
): headers is { get(name: string): string | null } {
  return typeof (headers as { get?: unknown }).get === "function";
}

function parseRequestUrl(input: string): ParsedUrl {
  const URLCtor = (globalThis as { URL?: URLConstructorLike }).URL;

  if (URLCtor === undefined) {
    throw new Error("URL is required to normalize Fastly Compute requests");
  }

  return new URLCtor(input);
}

function defaultFastlyFetch<TResponse>(): FastlyComputeFetch<TResponse> {
  const fetch = (globalThis as { fetch?: FastlyComputeFetch<TResponse> }).fetch;

  if (fetch === undefined) {
    throw new Error("fetch is required to run the Fastly Compute collector");
  }

  return fetch;
}
