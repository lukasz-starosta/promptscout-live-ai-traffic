import type { LiveAiTrafficEvent } from "./index.js";
import {
  hmacSha256Hex,
  sanitizeLiveAiTrafficEventForIngest,
  type WebCryptoLike,
} from "./privacy.js";

export type LiveAiTrafficFetchResponse = {
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
};

export type LiveAiTrafficFetchInit = {
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

export type LiveAiTrafficFetch = (
  url: string,
  init: LiveAiTrafficFetchInit,
) => Promise<LiveAiTrafficFetchResponse>;

export type LiveAiTrafficRetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

export type LiveAiTrafficIngestClientOptions = {
  endpoint: string;
  ingestToken: string;
  siteId?: string;
  signingSecret?: string;
  fetch?: LiveAiTrafficFetch;
  crypto?: WebCryptoLike;
  retry?: LiveAiTrafficRetryOptions;
  now?: () => Date;
};

export type LiveAiTrafficIngestResult =
  | {
      ok: true;
      status: number;
      attempts: number;
      retryable: false;
      authFailure: false;
      responseBody?: string;
    }
  | {
      ok: false;
      status?: number;
      attempts: number;
      retryable: boolean;
      authFailure: boolean;
      responseBody?: string;
      error?: Error;
    };

export type LiveAiTrafficIngestClient = {
  send(event: LiveAiTrafficEvent): Promise<LiveAiTrafficIngestResult>;
  sendBatch(
    events: readonly LiveAiTrafficEvent[],
  ): Promise<LiveAiTrafficIngestResult>;
};

export type LiveAiTrafficBatcher = {
  push(event: LiveAiTrafficEvent): LiveAiTrafficEvent[] | undefined;
  flush(): LiveAiTrafficEvent[];
  size(): number;
};

export type LiveAiTrafficDeliveryOptions =
  | {
      mode: "blocking";
      event: LiveAiTrafficEvent;
      client: LiveAiTrafficIngestClient;
    }
  | {
      mode: "waitUntil";
      event: LiveAiTrafficEvent;
      client: LiveAiTrafficIngestClient;
      waitUntil: (promise: Promise<LiveAiTrafficIngestResult>) => void;
    }
  | {
      mode: "background";
      event: LiveAiTrafficEvent;
      client: LiveAiTrafficIngestClient;
    }
  | {
      mode: "logForwarder";
      event: LiveAiTrafficEvent;
      client?: LiveAiTrafficIngestClient;
      logForwarder: (event: LiveAiTrafficEvent) => void;
    };

export type LiveAiTrafficScheduledDelivery =
  | { mode: "waitUntil" }
  | { mode: "background"; promise: Promise<LiveAiTrafficIngestResult> }
  | { mode: "logForwarder" };

export function createLiveAiTrafficIngestClient(
  options: LiveAiTrafficIngestClientOptions,
): LiveAiTrafficIngestClient {
  const retry = {
    maxRetries: options.retry?.maxRetries ?? 2,
    baseDelayMs: options.retry?.baseDelayMs ?? 100,
    maxDelayMs: options.retry?.maxDelayMs ?? 1_000,
    sleep: options.retry?.sleep ?? defaultSleep,
  };
  const fetch = options.fetch ?? defaultFetch();

  if (options.endpoint.length === 0) {
    throw new Error("PromptScout live AI traffic ingest endpoint is required");
  }

  if (options.ingestToken.length === 0) {
    throw new Error("PromptScout live AI traffic ingest token is required");
  }

  const sendBatch = async (
    events: readonly LiveAiTrafficEvent[],
  ): Promise<LiveAiTrafficIngestResult> => {
    const body = JSON.stringify({
      events: events.map((event) => sanitizeLiveAiTrafficEventForIngest(event)),
    });
    const headers = await ingestHeaders(options, body);
    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts <= retry.maxRetries) {
      attempts += 1;

      try {
        const response = await fetch(options.endpoint, {
          method: "POST",
          headers,
          body,
        });
        const responseBody = await readResponseBody(response);
        const authFailure = response.status === 401 || response.status === 403;
        const retryable = isRetryableStatus(response.status);

        if (response.ok) {
          return {
            ok: true,
            status: response.status,
            attempts,
            retryable: false,
            authFailure: false,
            ...(responseBody === undefined ? {} : { responseBody }),
          };
        }

        if (!retryable || authFailure || attempts > retry.maxRetries) {
          return {
            ok: false,
            status: response.status,
            attempts,
            retryable: retryable && !authFailure,
            authFailure,
            ...(responseBody === undefined ? {} : { responseBody }),
          };
        }
      } catch (error) {
        lastError = asError(error);
        if (attempts > retry.maxRetries) {
          return {
            ok: false,
            attempts,
            retryable: true,
            authFailure: false,
            error: lastError,
          };
        }
      }

      await retry.sleep(backoffDelay(attempts, retry));
    }

    return {
      ok: false,
      attempts,
      retryable: true,
      authFailure: false,
      ...(lastError === undefined ? {} : { error: lastError }),
    };
  };

  return {
    send(event) {
      return sendBatch([event]);
    },
    sendBatch,
  };
}

export function createLiveAiTrafficBatcher(options: {
  maxBatchSize: number;
}): LiveAiTrafficBatcher {
  if (!Number.isInteger(options.maxBatchSize) || options.maxBatchSize < 1) {
    throw new Error("maxBatchSize must be a positive integer");
  }

  let pending: LiveAiTrafficEvent[] = [];

  const flush = (): LiveAiTrafficEvent[] => {
    const batch = pending;
    pending = [];
    return batch;
  };

  return {
    push(event) {
      pending.push(event);
      if (pending.length < options.maxBatchSize) {
        return undefined;
      }

      return flush();
    },
    flush,
    size() {
      return pending.length;
    },
  };
}

export function deliverLiveAiTrafficEvent(
  options: Extract<LiveAiTrafficDeliveryOptions, { mode: "blocking" }>,
): Promise<LiveAiTrafficIngestResult>;
export function deliverLiveAiTrafficEvent(
  options: Exclude<LiveAiTrafficDeliveryOptions, { mode: "blocking" }>,
): LiveAiTrafficScheduledDelivery;
export function deliverLiveAiTrafficEvent(
  options: LiveAiTrafficDeliveryOptions,
): Promise<LiveAiTrafficIngestResult> | LiveAiTrafficScheduledDelivery {
  if (options.mode === "blocking") {
    return options.client.send(options.event);
  }

  if (options.mode === "waitUntil") {
    options.waitUntil(options.client.send(options.event));
    return { mode: "waitUntil" };
  }

  if (options.mode === "background") {
    return {
      mode: "background",
      promise: options.client.send(options.event),
    };
  }

  options.logForwarder(options.event);
  return { mode: "logForwarder" };
}

async function ingestHeaders(
  options: LiveAiTrafficIngestClientOptions,
  body: string,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${options.ingestToken}`,
  };

  if (options.siteId !== undefined) {
    headers["x-promptscout-site-id"] = options.siteId;
  }

  if (options.signingSecret !== undefined) {
    const timestamp = (options.now?.() ?? new Date()).toISOString();
    headers["x-promptscout-timestamp"] = timestamp;
    headers["x-promptscout-signature"] = `sha256=${await hmacSha256Hex(
      `${timestamp}.${body}`,
      options.signingSecret,
      options.crypto,
    )}`;
  }

  return headers;
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function backoffDelay(
  attempt: number,
  retry: Required<LiveAiTrafficRetryOptions>,
): number {
  return Math.min(retry.baseDelayMs * 2 ** (attempt - 1), retry.maxDelayMs);
}

async function readResponseBody(
  response: LiveAiTrafficFetchResponse,
): Promise<string | undefined> {
  if (response.text === undefined) {
    return undefined;
  }

  const body = await response.text();
  return body.length === 0 ? undefined : body;
}

function defaultFetch(): LiveAiTrafficFetch {
  const fetch = (globalThis as { fetch?: LiveAiTrafficFetch }).fetch;

  if (fetch === undefined) {
    throw new Error("fetch is required for PromptScout live AI traffic ingest");
  }

  return fetch;
}

function defaultSleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  const setTimeoutFn = (
    globalThis as {
      setTimeout?: (callback: () => void, delayMs: number) => unknown;
    }
  ).setTimeout;

  if (setTimeoutFn === undefined) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeoutFn(resolve, delayMs);
  });
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
