import type {
  LiveAiTrafficEvent,
  LiveAiTrafficIpHashAlgorithm,
} from "./index.js";

export type WebCryptoLike = {
  subtle?: {
    digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
    importKey(
      format: "raw",
      keyData: Uint8Array,
      algorithm: { name: string; hash: string },
      extractable: boolean,
      keyUsages: readonly ["sign"],
    ): Promise<unknown>;
    sign(
      algorithm: string,
      key: unknown,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;
  };
};

export type LiveAiTrafficIpHashOptions = {
  salt: string;
  keyId?: string;
  algorithm?: Exclude<LiveAiTrafficIpHashAlgorithm, "none">;
  truncatedBits?: number;
  crypto?: WebCryptoLike;
};

export type LiveAiTrafficPrivacyOptions = {
  ip?:
    | {
        mode: "hash";
        value?: string;
        salt: string;
        keyId?: string;
        algorithm?: Exclude<LiveAiTrafficIpHashAlgorithm, "none">;
        truncatedBits?: number;
        crypto?: WebCryptoLike;
      }
    | { mode: "omit"; value?: string }
    | { mode: "none" | "disabled"; value?: string };
  path?: {
    mode: "keep" | "redact";
    replacement?: string;
  };
  query?: {
    mode: "keep" | "omit" | "allowlist";
    allow?: readonly string[];
  };
};

export type LiveAiTrafficHeaderMap = Record<string, string>;

export async function hashLiveAiTrafficIp(
  ipAddress: string,
  options: LiveAiTrafficIpHashOptions,
): Promise<NonNullable<LiveAiTrafficEvent["ipHash"]>> {
  const algorithm = options.algorithm ?? "hmac-sha256";
  const value =
    algorithm === "sha256"
      ? await sha256Hex(`${options.salt}:${ipAddress}`, options.crypto)
      : await hmacSha256Hex(ipAddress, options.salt, options.crypto);

  return {
    algorithm,
    value:
      options.truncatedBits === undefined
        ? value
        : value.slice(0, Math.ceil(options.truncatedBits / 4)),
    ...(options.keyId === undefined ? {} : { keyId: options.keyId }),
    ...(options.truncatedBits === undefined
      ? {}
      : { truncatedBits: options.truncatedBits }),
    originalIpRetention: "discarded_after_hash",
  };
}

export async function normalizeLiveAiTrafficEvent(
  event: LiveAiTrafficEvent,
  options: LiveAiTrafficPrivacyOptions = {},
): Promise<LiveAiTrafficEvent> {
  const normalized: LiveAiTrafficEvent = {
    ...event,
    request: { ...event.request },
    providerClassification: { ...event.providerClassification },
    ...(event.location === undefined
      ? {}
      : { location: { ...event.location } }),
    ...(event.ipHash === undefined ? {} : { ipHash: { ...event.ipHash } }),
    ...(event.integration === undefined
      ? {}
      : { integration: { ...event.integration } }),
  };

  if (options.path?.mode === "redact") {
    normalized.request.path =
      options.path.replacement ?? "/_promptscout/redacted";
  }

  if (options.query?.mode === "omit") {
    keepSafeQueryAttributionOrDelete(normalized);
  } else if (options.query?.mode === "allowlist") {
    const search = filterSearchParams(
      normalized.request.search,
      new Set(options.query.allow ?? []),
    );

    if (search.length === 0) {
      delete normalized.request.search;
    } else {
      normalized.request.search = search;
    }
  }

  sanitizeRefererInPlace(normalized);
  sanitizeAiReferralVisitSearchInPlace(normalized);

  if (options.ip?.mode === "omit") {
    delete normalized.ipHash;
  } else if (options.ip?.mode === "none" || options.ip?.mode === "disabled") {
    normalized.ipHash = {
      algorithm: "none",
      originalIpRetention: "not_collected",
    };
  } else if (options.ip?.mode === "hash") {
    if (
      options.ip.value === undefined ||
      options.ip.value.trim().length === 0
    ) {
      delete normalized.ipHash;
    } else {
      normalized.ipHash = await hashLiveAiTrafficIp(options.ip.value, {
        salt: options.ip.salt,
        keyId: options.ip.keyId,
        algorithm: options.ip.algorithm,
        truncatedBits: options.ip.truncatedBits,
        crypto: options.ip.crypto,
      });
    }
  }

  return normalized;
}

export function filterLiveAiTrafficHeaders(
  headers: unknown,
  allowlist: readonly string[],
): LiveAiTrafficHeaderMap {
  const allowed = new Set(allowlist.map((header) => header.toLowerCase()));
  const filtered: LiveAiTrafficHeaderMap = {};

  for (const [name, value] of headerEntries(headers)) {
    const normalizedName = name.toLowerCase();
    if (!allowed.has(normalizedName)) {
      continue;
    }

    const normalizedValue = normalizeHeaderValue(value);
    if (normalizedValue !== undefined) {
      filtered[normalizedName] = isRefererHeader(normalizedName)
        ? sanitizeLiveAiTrafficReferer(normalizedValue)
        : normalizedValue;
    }
  }

  return filtered;
}

export function sanitizeLiveAiTrafficEventForIngest(
  event: LiveAiTrafficEvent,
): LiveAiTrafficEvent {
  const sanitized: LiveAiTrafficEvent = {
    ...event,
    request: { ...event.request },
    providerClassification: { ...event.providerClassification },
    ...(event.location === undefined
      ? {}
      : { location: { ...event.location } }),
    ...(event.ipHash === undefined ? {} : { ipHash: { ...event.ipHash } }),
    ...(event.integration === undefined
      ? {}
      : { integration: { ...event.integration } }),
  };

  sanitizeRefererInPlace(sanitized);
  sanitizeAiReferralVisitSearchInPlace(sanitized);

  return sanitized;
}

export function sanitizeLiveAiTrafficReferer(referer: string): string {
  const trimmed = referer.trim();
  const queryIndex = trimmed.indexOf("?");
  const hashIndex = trimmed.indexOf("#");
  const cutoff = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return cutoff === undefined ? trimmed : trimmed.slice(0, cutoff);
}

export async function hmacSha256Hex(
  value: string,
  secret: string,
  cryptoOverride?: WebCryptoLike,
): Promise<string> {
  const subtle = subtleCrypto(cryptoOverride);
  const key = await subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign("HMAC", key, utf8(value));

  return hex(signature);
}

async function sha256Hex(
  value: string,
  cryptoOverride?: WebCryptoLike,
): Promise<string> {
  return hex(await subtleCrypto(cryptoOverride).digest("SHA-256", utf8(value)));
}

function subtleCrypto(
  cryptoOverride?: WebCryptoLike,
): NonNullable<WebCryptoLike["subtle"]> {
  const crypto =
    cryptoOverride ?? (globalThis as { crypto?: WebCryptoLike }).crypto;

  if (crypto?.subtle === undefined) {
    throw new Error(
      "Web Crypto subtle API is required for live AI traffic hashing",
    );
  }

  return crypto.subtle;
}

function utf8(value: string): Uint8Array {
  const TextEncoderCtor = (
    globalThis as {
      TextEncoder?: new () => { encode(input: string): Uint8Array };
    }
  ).TextEncoder;

  if (TextEncoderCtor === undefined) {
    throw new Error("TextEncoder is required for live AI traffic hashing");
  }

  return new TextEncoderCtor().encode(value);
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function filterSearchParams(
  search: string | undefined,
  allowed: ReadonlySet<string>,
): string {
  if (search === undefined || search.length === 0 || allowed.size === 0) {
    return "";
  }

  const body = search.startsWith("?") ? search.slice(1) : search;
  const kept: string[] = [];

  for (const pair of body.split("&")) {
    if (pair.length === 0) {
      continue;
    }

    const [rawKey] = pair.split("=", 1);
    const key = decodeFormComponent(rawKey);
    if (allowed.has(key)) {
      kept.push(pair);
    }
  }

  return kept.length === 0 ? "" : `?${kept.join("&")}`;
}

function sanitizeRefererInPlace(event: LiveAiTrafficEvent): void {
  if (event.request.referer === undefined) {
    return;
  }

  const sanitized = sanitizeLiveAiTrafficReferer(event.request.referer);
  if (sanitized.length === 0) {
    delete event.request.referer;
  } else {
    event.request.referer = sanitized;
  }
}

function sanitizeAiReferralVisitSearchInPlace(event: LiveAiTrafficEvent): void {
  if (event.providerClassification.agentType !== "ai_referral_visit") {
    return;
  }

  if (!event.providerClassification.matchedBy.includes("query")) {
    delete event.request.search;
    return;
  }

  const safeSearch = safeLandingQueryAttributionSearch(
    event.request.search,
    event.providerClassification.provider,
  );
  if (safeSearch === undefined) {
    delete event.request.search;
  } else {
    event.request.search = safeSearch;
  }
}

function keepSafeQueryAttributionOrDelete(event: LiveAiTrafficEvent): void {
  if (
    event.providerClassification.agentType === "ai_referral_visit" &&
    event.providerClassification.matchedBy.includes("query")
  ) {
    const safeSearch = safeLandingQueryAttributionSearch(
      event.request.search,
      event.providerClassification.provider,
    );
    if (safeSearch !== undefined) {
      event.request.search = safeSearch;
      return;
    }
  }

  delete event.request.search;
}

function safeLandingQueryAttributionSearch(
  search: string | undefined,
  provider: LiveAiTrafficEvent["providerClassification"]["provider"],
): string | undefined {
  if (search === undefined || provider !== "openai_chatgpt_referral") {
    return undefined;
  }

  const body = search.startsWith("?") ? search.slice(1) : search;
  for (const pair of body.split("&")) {
    if (pair.length === 0) {
      continue;
    }

    const [rawKey = "", rawValue = ""] = pair.split("=", 2);
    const key = decodeFormComponent(rawKey).toLowerCase();
    if (key !== "utm_source" && key !== "source") {
      continue;
    }

    const value = decodeFormComponent(rawValue).trim();
    if (isSafeOpenAiQueryAttributionValue(value)) {
      return `?${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
  }

  return undefined;
}

function isSafeOpenAiQueryAttributionValue(value: string): boolean {
  const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    normalizedValue === "chatgpt" ||
    normalizedValue === "chatgptcom" ||
    normalizedValue === "chatopenaicom"
  );
}

function isRefererHeader(name: string): boolean {
  return name === "referer" || name === "referrer";
}

function decodeFormComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function headerEntries(headers: unknown): [string, unknown][] {
  if (!isRecord(headers)) {
    return [];
  }

  if (typeof headers.forEach === "function") {
    const entries: [string, unknown][] = [];
    headers.forEach((value: unknown, name: unknown) => {
      if (typeof name === "string") {
        entries.push([name, value]);
      }
    });
    return entries;
  }

  return Object.entries(headers);
}

function normalizeHeaderValue(input: unknown): string | undefined {
  if (Array.isArray(input)) {
    return normalizeHeaderValue(input[0]);
  }

  if (typeof input !== "string") {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
