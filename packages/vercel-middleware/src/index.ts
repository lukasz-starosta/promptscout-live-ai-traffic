import {
  classifyAiTraffic,
  createLiveAiTrafficIngestClient,
  createLiveAiTrafficSetupProbeClient,
  createLiveAiTrafficSetupProbeEvent,
  isPromptScoutSetupProbeHeaderValue,
  LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
  type LiveAiTrafficEvent,
  type LiveAiTrafficHttpMethod,
  type LiveAiTrafficIngestClientOptions,
  type LiveAiTrafficIngestResult,
  type LiveAiTrafficPrivacyOptions,
  type LiveAiTrafficSetupProbeEvent,
  normalizeLiveAiTrafficEvent,
  PROMPTSCOUT_SETUP_PROBE_HEADER,
  PROMPTSCOUT_SETUP_PROBE_ID_HEADER,
  PROMPTSCOUT_SETUP_PROBE_PATH,
  PROMPTSCOUT_SETUP_PROBE_TOKEN_HEADER,
  toLiveAiTrafficProviderClassification,
  type WebCryptoLike,
} from "@promptscout/live-ai-traffic/core";

type RuntimeUrl = {
  hostname: string;
  pathname: string;
  search: string;
};

declare const URL: {
  new (input: string): RuntimeUrl;
};

export type PromptScoutVercelHeaderBag =
  | {
      get(name: string): string | null | undefined;
    }
  | Record<string, unknown>
  | Iterable<readonly [string, unknown]>;

export type PromptScoutVercelRequestLike = {
  method?: string;
  url?: string;
  nextUrl?: {
    hostname?: string;
    pathname?: string;
    search?: string;
  };
  headers?: PromptScoutVercelHeaderBag;
};

export type PromptScoutVercelEventContextLike = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export type PromptScoutVercelPrivacyOptions = Omit<
  LiveAiTrafficPrivacyOptions,
  "ip"
> & {
  ip?:
    | {
        mode: "hash";
        value?: string;
        salt?: string;
        keyId?: string;
        truncatedBits?: number;
        crypto?: WebCryptoLike;
      }
    | { mode: "omit"; value?: string }
    | { mode: "none" | "disabled"; value?: string };
};

export type BuildPromptScoutVercelAiTrafficEventOptions = {
  now?: () => Date;
  privacy?: PromptScoutVercelPrivacyOptions;
};

export type TrackPromptScoutAiTrafficOptions = Omit<
  LiveAiTrafficIngestClientOptions,
  "now"
> & {
  probeEndpoint?: string;
  now?: () => Date;
  privacy?: PromptScoutVercelPrivacyOptions;
  includeUnknown?: boolean;
};

export type TrackPromptScoutAiTrafficResult =
  | {
      mode: "waitUntil";
      tracked: true;
    }
  | {
      mode: "background";
      tracked: true;
      promise: Promise<LiveAiTrafficIngestResult>;
    }
  | {
      mode: "waitUntil";
      tracked: true;
      probe: true;
    }
  | {
      mode: "background";
      tracked: true;
      probe: true;
      promise: Promise<LiveAiTrafficIngestResult>;
    }
  | {
      mode: "skipped";
      tracked: false;
      reason: "unknown_classification";
    };

type NormalizedVercelRequest = {
  host: string;
  path: string;
  search?: string;
  method: LiveAiTrafficHttpMethod;
  userAgent?: string;
  referer?: string;
  requestId?: string;
  country?: string;
  region?: string;
  clientIp?: string;
};

const supportedMethods = new Set<LiveAiTrafficHttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export const promptScoutVercelRecommendedMatcher = [
  "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|xml)$).*)",
];

export async function buildPromptScoutVercelAiTrafficEvent(
  request: PromptScoutVercelRequestLike,
  options: BuildPromptScoutVercelAiTrafficEventOptions = {},
): Promise<LiveAiTrafficEvent> {
  const normalizedRequest = normalizeVercelRequest(request);
  const classification = classifyAiTraffic({
    userAgent: normalizedRequest.userAgent,
    referer: normalizedRequest.referer,
    search: normalizedRequest.search,
    headers: request.headers,
  });
  const event = createVercelEvent(
    normalizedRequest,
    classification,
    options.now,
  );

  return normalizeLiveAiTrafficEvent(
    event,
    normalizePrivacyOptions(options.privacy, normalizedRequest),
  );
}

export function trackPromptScoutAiTraffic(
  request: PromptScoutVercelRequestLike,
  eventOrContext: PromptScoutVercelEventContextLike | undefined,
  options: TrackPromptScoutAiTrafficOptions,
): TrackPromptScoutAiTrafficResult {
  const normalizedRequest = normalizeVercelRequest(request);

  if (normalizedRequest.path === PROMPTSCOUT_SETUP_PROBE_PATH) {
    const probe = createVercelSetupProbeEvent(
      normalizedRequest,
      request.headers,
      options.now,
    );
    if (probe !== undefined) {
      const client = createLiveAiTrafficSetupProbeClient({
        endpoint: options.probeEndpoint ?? options.endpoint,
        ingestToken: options.ingestToken,
        siteId: options.siteId,
        signingSecret: options.signingSecret,
        fetch: options.fetch,
        crypto: options.crypto,
        retry: options.retry,
        now: options.now,
      });
      const promise = client.sendProbe(probe);

      if (eventOrContext?.waitUntil !== undefined) {
        eventOrContext.waitUntil(promise);
        return { mode: "waitUntil", tracked: true, probe: true };
      }

      return { mode: "background", tracked: true, probe: true, promise };
    }
  }

  const classification = classifyAiTraffic({
    userAgent: normalizedRequest.userAgent,
    referer: normalizedRequest.referer,
    search: normalizedRequest.search,
    headers: request.headers,
  });

  if (classification.provider === "other" && options.includeUnknown !== true) {
    return {
      mode: "skipped",
      tracked: false,
      reason: "unknown_classification",
    };
  }

  const client = createLiveAiTrafficIngestClient({
    endpoint: options.endpoint,
    ingestToken: options.ingestToken,
    siteId: options.siteId,
    signingSecret: options.signingSecret,
    fetch: options.fetch,
    crypto: options.crypto,
    retry: options.retry,
    now: options.now,
  });
  const promise = sendTrackedEvent(request, normalizedRequest, options, client);

  if (eventOrContext?.waitUntil !== undefined) {
    eventOrContext.waitUntil(promise);
    return { mode: "waitUntil", tracked: true };
  }

  return { mode: "background", tracked: true, promise };
}

function createVercelSetupProbeEvent(
  request: NormalizedVercelRequest,
  headers: PromptScoutVercelHeaderBag | undefined,
  now: (() => Date) | undefined,
): LiveAiTrafficSetupProbeEvent | undefined {
  if (
    !isPromptScoutSetupProbeHeaderValue(
      headerValue(headers, PROMPTSCOUT_SETUP_PROBE_HEADER),
    )
  ) {
    return undefined;
  }

  const probeId = headerValue(headers, PROMPTSCOUT_SETUP_PROBE_ID_HEADER);
  const probeToken = headerValue(headers, PROMPTSCOUT_SETUP_PROBE_TOKEN_HEADER);

  if (probeId === undefined || probeToken === undefined) {
    return undefined;
  }

  return createLiveAiTrafficSetupProbeEvent({
    sourceProvider: "vercel",
    now,
    probe: {
      id: probeId,
      token: probeToken,
    },
    request: {
      host: request.host,
      path: request.path,
      ...(request.search === undefined ? {} : { search: request.search }),
      method: request.method,
      ...(request.userAgent === undefined
        ? {}
        : { userAgent: request.userAgent }),
      ...(request.referer === undefined ? {} : { referer: request.referer }),
    },
    integration: {
      kind: "vercel_nextjs_middleware",
      name: "vercel-middleware",
      ...(request.requestId === undefined
        ? {}
        : { requestId: request.requestId }),
    },
  });
}

async function sendTrackedEvent(
  request: PromptScoutVercelRequestLike,
  normalizedRequest: NormalizedVercelRequest,
  options: TrackPromptScoutAiTrafficOptions,
  client: ReturnType<typeof createLiveAiTrafficIngestClient>,
): Promise<LiveAiTrafficIngestResult> {
  try {
    const event = await buildEventFromNormalizedRequest(
      request,
      normalizedRequest,
      options,
    );
    return client.send(event);
  } catch (error) {
    return {
      ok: false,
      attempts: 0,
      retryable: false,
      authFailure: false,
      error: asError(error),
    };
  }
}

async function buildEventFromNormalizedRequest(
  request: PromptScoutVercelRequestLike,
  normalizedRequest: NormalizedVercelRequest,
  options: TrackPromptScoutAiTrafficOptions,
): Promise<LiveAiTrafficEvent> {
  const classification = classifyAiTraffic({
    userAgent: normalizedRequest.userAgent,
    referer: normalizedRequest.referer,
    search: normalizedRequest.search,
    headers: request.headers,
  });
  const event = createVercelEvent(
    normalizedRequest,
    classification,
    options.now,
  );

  return normalizeLiveAiTrafficEvent(
    event,
    normalizePrivacyOptions(options.privacy, normalizedRequest, {
      ingestToken: options.ingestToken,
      siteId: options.siteId,
    }),
  );
}

function createVercelEvent(
  request: NormalizedVercelRequest,
  classification: ReturnType<typeof classifyAiTraffic>,
  now: (() => Date) | undefined,
): LiveAiTrafficEvent {
  return {
    schemaVersion: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    eventKind: "request_observation",
    sourceProvider: "vercel",
    observedAt: (now?.() ?? new Date()).toISOString(),
    request: {
      host: request.host,
      path: request.path,
      ...(request.search === undefined ? {} : { search: request.search }),
      method: request.method,
      ...(request.userAgent === undefined
        ? {}
        : { userAgent: request.userAgent }),
      ...(request.referer === undefined ? {} : { referer: request.referer }),
    },
    providerClassification:
      toLiveAiTrafficProviderClassification(classification),
    ...(request.country === undefined && request.region === undefined
      ? {}
      : {
          location: {
            ...(request.country === undefined
              ? {}
              : { country: request.country }),
            ...(request.region === undefined ? {} : { region: request.region }),
          },
        }),
    integration: {
      kind: "vercel_nextjs_middleware",
      name: "vercel-middleware",
      ...(request.requestId === undefined
        ? {}
        : { requestId: request.requestId }),
    },
  };
}

function normalizeVercelRequest(
  request: PromptScoutVercelRequestLike,
): NormalizedVercelRequest {
  const parsedUrl = parseRequestUrl(request.url);
  const host =
    nonEmptyString(request.nextUrl?.hostname) ??
    headerValue(request.headers, "host") ??
    parsedUrl?.hostname ??
    "unknown";
  const path = ensurePath(
    nonEmptyString(request.nextUrl?.pathname) ?? parsedUrl?.pathname,
  );
  const search = normalizeSearch(
    nonEmptyString(request.nextUrl?.search) ?? parsedUrl?.search,
  );
  const userAgent = headerValue(request.headers, "user-agent");
  const referer = firstHeaderValue(request.headers, "referer", "referrer");
  const requestId = firstHeaderValue(
    request.headers,
    "x-vercel-id",
    "x-request-id",
  );
  const country = normalizeCountry(
    headerValue(request.headers, "x-vercel-ip-country"),
  );
  const region = nonEmptyString(
    headerValue(request.headers, "x-vercel-ip-country-region"),
  );
  const forwardedClientIp = clientIp(request.headers);

  return {
    host,
    path,
    ...(search === undefined ? {} : { search }),
    method: normalizeMethod(request.method),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(referer === undefined ? {} : { referer }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(country === undefined ? {} : { country }),
    ...(region === undefined ? {} : { region }),
    ...(forwardedClientIp === undefined ? {} : { clientIp: forwardedClientIp }),
  };
}

function normalizePrivacyOptions(
  options: PromptScoutVercelPrivacyOptions | undefined,
  request: NormalizedVercelRequest,
  ingest?: { ingestToken: string; siteId?: string },
): LiveAiTrafficPrivacyOptions {
  const ip = options?.ip ?? { mode: "disabled" };

  if (ip.mode === "hash") {
    const salt =
      ip.salt ??
      (ingest === undefined
        ? undefined
        : `${ingest.siteId ?? "promptscout"}:${ingest.ingestToken}`);

    if (salt === undefined) {
      throw new Error("IP hashing requires a salt");
    }

    return {
      path: options?.path,
      query: options?.query,
      ip: {
        mode: "hash",
        value: ip.value ?? request.clientIp,
        salt,
        keyId: ip.keyId,
        truncatedBits: ip.truncatedBits,
        crypto: ip.crypto,
      },
    };
  }

  return {
    path: options?.path,
    query: options?.query,
    ip,
  };
}

function parseRequestUrl(url: string | undefined): RuntimeUrl | undefined {
  if (url === undefined || url.trim().length === 0) {
    return undefined;
  }

  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function normalizeMethod(method: string | undefined): LiveAiTrafficHttpMethod {
  const normalized = method?.toUpperCase();
  if (
    normalized !== undefined &&
    supportedMethods.has(normalized as LiveAiTrafficHttpMethod)
  ) {
    return normalized as LiveAiTrafficHttpMethod;
  }

  return "OTHER";
}

function ensurePath(path: string | undefined): string {
  if (path === undefined || path.length === 0) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeSearch(search: string | undefined): string | undefined {
  if (search === undefined || search.length === 0 || search === "?") {
    return undefined;
  }

  return search.startsWith("?") ? search : `?${search}`;
}

function firstHeaderValue(
  headers: PromptScoutVercelHeaderBag | undefined,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = headerValue(headers, name);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function headerValue(
  headers: PromptScoutVercelHeaderBag | undefined,
  name: string,
): string | undefined {
  if (headers === undefined) {
    return undefined;
  }

  if (hasHeaderGetter(headers)) {
    return nonEmptyString(headers.get(name));
  }

  const normalizedName = name.toLowerCase();

  if (isIterableHeaders(headers)) {
    for (const [key, value] of headers) {
      if (key.toLowerCase() === normalizedName) {
        return nonEmptyString(value);
      }
    }

    return undefined;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedName) {
      return nonEmptyString(value);
    }
  }

  return undefined;
}

function hasHeaderGetter(
  headers: PromptScoutVercelHeaderBag,
): headers is { get(name: string): string | null | undefined } {
  return typeof (headers as { get?: unknown }).get === "function";
}

function isIterableHeaders(
  headers: PromptScoutVercelHeaderBag,
): headers is Iterable<readonly [string, unknown]> {
  return (
    typeof (headers as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
    "function"
  );
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeCountry(value: unknown): string | undefined {
  const country = nonEmptyString(value)?.toUpperCase();
  if (country === undefined || !/^[A-Z]{2}$/.test(country)) {
    return undefined;
  }

  return country;
}

function clientIp(
  headers: PromptScoutVercelHeaderBag | undefined,
): string | undefined {
  const forwardedFor = firstHeaderValue(
    headers,
    "x-forwarded-for",
    "x-real-ip",
  );

  return forwardedFor?.split(",")[0]?.trim();
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
