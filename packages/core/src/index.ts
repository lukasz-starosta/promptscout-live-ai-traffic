export type PlaceholderIntegration = {
  provider: string;
  status: "placeholder";
  notes: string;
};

export * from "./ingest.js";
export * from "./privacy.js";

export function createPlaceholderIntegration(
  provider: string,
): PlaceholderIntegration {
  return {
    provider,
    status: "placeholder",
    notes: "Scaffold only. Runtime implementation is intentionally deferred.",
  };
}

export const LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION = 1;

export const liveAiTrafficSourceProviders = [
  "vercel",
  "cloudflare",
  "netlify",
  "nginx_log_forwarder",
  "wordpress",
  "node_express",
  "cloudfront_aws",
  "fastly",
  "manual",
  "other",
] as const;

export const liveAiTrafficClassifiedProviders = [
  "openai_search_bot",
  "openai_gptbot",
  "openai_chatgpt_user",
  "anthropic_claudebot",
  "anthropic_claude_search_bot",
  "anthropic_claude_user",
  "perplexitybot",
  "perplexity_user",
  "perplexity_referral",
  "google_crawler",
  "google_agent",
  "google_notebooklm",
  "google_referral",
  "meta_external_agent",
  "meta_external_fetcher",
  "bytedance_bytespider",
  "ai_browser_referral",
  "other",
] as const;

export const liveAiTrafficAgentTypes = [
  "ai_search_crawler",
  "ai_training_crawler",
  "ai_browser_user",
  "link_preview",
  "ai_assistant_referral",
  "search_crawler",
  "search_referral",
  "other",
] as const;

export const liveAiTrafficHttpMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "OTHER",
] as const;

export const liveAiTrafficMatchKinds = [
  "user_agent",
  "referer",
  "host",
  "path",
  "manual",
  "other",
] as const;

export const liveAiTrafficIpHashAlgorithms = [
  "hmac-sha256",
  "sha256",
  "none",
] as const;

export type LiveAiTrafficSourceProvider =
  (typeof liveAiTrafficSourceProviders)[number];
export type LiveAiTrafficClassifiedProvider =
  (typeof liveAiTrafficClassifiedProviders)[number];
export type LiveAiTrafficAgentType = (typeof liveAiTrafficAgentTypes)[number];
export type LiveAiTrafficHttpMethod = (typeof liveAiTrafficHttpMethods)[number];
export type LiveAiTrafficMatchKind = (typeof liveAiTrafficMatchKinds)[number];
export type LiveAiTrafficIpHashAlgorithm =
  (typeof liveAiTrafficIpHashAlgorithms)[number];

export type AiTrafficClassification = {
  provider: LiveAiTrafficClassifiedProvider;
  agentType: LiveAiTrafficAgentType;
  confidence: number;
  matchedRule: string;
  matchedBy: LiveAiTrafficMatchKind[];
  docsUrl?: string;
};

export type LiveAiTrafficProviderClassification = {
  provider: LiveAiTrafficClassifiedProvider;
  agentType: LiveAiTrafficAgentType;
  confidence: number;
  matchedBy: LiveAiTrafficMatchKind[];
};

export type AiTrafficRequestLike = {
  userAgent?: unknown;
  referer?: unknown;
  referrer?: unknown;
  headers?: unknown;
};

type ClassificationRule = {
  id: string;
  provider: LiveAiTrafficClassifiedProvider;
  agentType: LiveAiTrafficAgentType;
  confidence: number;
  docsUrl?: string;
  patterns: readonly RegExp[];
};

const openAiBotsDocsUrl = "https://platform.openai.com/docs/bots";
const anthropicBotsDocsUrl =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const googleCommonCrawlersDocsUrl =
  "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers";
const googleUserFetchersDocsUrl =
  "https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers";
const metaCrawlerDocsUrl =
  "https://developers.facebook.com/docs/sharing/webmasters/crawler";

const userAgentRules: readonly ClassificationRule[] = [
  {
    id: "ua:openai:oai-searchbot",
    provider: "openai_search_bot",
    agentType: "ai_search_crawler",
    confidence: 0.99,
    docsUrl: openAiBotsDocsUrl,
    patterns: [/\boai-searchbot(?:\/|\b)/i],
  },
  {
    id: "ua:openai:gptbot",
    provider: "openai_gptbot",
    agentType: "ai_training_crawler",
    confidence: 0.98,
    docsUrl: openAiBotsDocsUrl,
    patterns: [/\bgptbot(?:\/|\b)/i],
  },
  {
    id: "ua:openai:chatgpt-user",
    provider: "openai_chatgpt_user",
    agentType: "ai_browser_user",
    confidence: 0.96,
    docsUrl: openAiBotsDocsUrl,
    patterns: [/\bchatgpt-user(?:\/|\b)/i],
  },
  {
    id: "ua:anthropic:claude-searchbot",
    provider: "anthropic_claude_search_bot",
    agentType: "ai_search_crawler",
    confidence: 0.96,
    docsUrl: anthropicBotsDocsUrl,
    patterns: [/\bclaude-searchbot(?:\/|\b)/i],
  },
  {
    id: "ua:anthropic:claude-user",
    provider: "anthropic_claude_user",
    agentType: "ai_browser_user",
    confidence: 0.94,
    docsUrl: anthropicBotsDocsUrl,
    patterns: [/\bclaude-user(?:\/|\b)/i],
  },
  {
    id: "ua:anthropic:claudebot",
    provider: "anthropic_claudebot",
    agentType: "ai_training_crawler",
    confidence: 0.96,
    docsUrl: anthropicBotsDocsUrl,
    patterns: [/\bclaudebot(?:\/|\b)/i],
  },
  {
    id: "ua:perplexity:perplexitybot",
    provider: "perplexitybot",
    agentType: "ai_search_crawler",
    confidence: 0.95,
    docsUrl: "https://docs.perplexity.ai/guides/bots",
    patterns: [/\bperplexitybot(?:\/|\b)/i],
  },
  {
    id: "ua:perplexity:perplexity-user",
    provider: "perplexity_user",
    agentType: "ai_browser_user",
    confidence: 0.92,
    docsUrl: "https://docs.perplexity.ai/guides/bots",
    patterns: [/\bperplexity-user(?:\/|\b)/i],
  },
  {
    id: "ua:google:google-agent",
    provider: "google_agent",
    agentType: "ai_browser_user",
    confidence: 0.91,
    docsUrl: googleUserFetchersDocsUrl,
    patterns: [/\bgoogle-agent(?:;|\/|\b)/i],
  },
  {
    id: "ua:google:notebooklm",
    provider: "google_notebooklm",
    agentType: "ai_browser_user",
    confidence: 0.9,
    docsUrl: googleUserFetchersDocsUrl,
    patterns: [/\bgoogle-notebooklm(?:\/|\b)/i],
  },
  {
    id: "ua:google:googleother",
    provider: "google_crawler",
    agentType: "search_crawler",
    confidence: 0.9,
    docsUrl: googleCommonCrawlersDocsUrl,
    patterns: [/\bgoogleother(?:-|;|\)|\b)/i],
  },
  {
    id: "ua:google:googlebot",
    provider: "google_crawler",
    agentType: "search_crawler",
    confidence: 0.9,
    docsUrl: googleCommonCrawlersDocsUrl,
    patterns: [/\bgooglebot(?:-|\/|\b)/i],
  },
  {
    id: "ua:meta:externalagent",
    provider: "meta_external_agent",
    agentType: "ai_training_crawler",
    confidence: 0.91,
    docsUrl: metaCrawlerDocsUrl,
    patterns: [/\bmeta-externalagent(?:\/|\b)/i],
  },
  {
    id: "ua:meta:externalfetcher",
    provider: "meta_external_fetcher",
    agentType: "link_preview",
    confidence: 0.86,
    docsUrl: metaCrawlerDocsUrl,
    patterns: [
      /\bmeta-externalfetcher(?:\/|\b)/i,
      /\bfacebookexternalhit(?:\/|\b)/i,
      /\bfacebot(?:\/|\b)/i,
    ],
  },
  {
    id: "ua:bytedance:bytespider",
    provider: "bytedance_bytespider",
    agentType: "ai_training_crawler",
    confidence: 0.9,
    patterns: [/\bbytespider(?:\/|;|\b)/i],
  },
] as const;

const refererRules: readonly ClassificationRule[] = [
  {
    id: "ref:openai:chatgpt",
    provider: "ai_browser_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.74,
    docsUrl: openAiBotsDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?chatgpt\.com(?:\/|$)/i],
  },
  {
    id: "ref:openai",
    provider: "ai_browser_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.7,
    docsUrl: openAiBotsDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?openai\.com(?:\/|$)/i],
  },
  {
    id: "ref:anthropic:claude",
    provider: "ai_browser_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.72,
    docsUrl: anthropicBotsDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?claude\.ai(?:\/|$)/i],
  },
  {
    id: "ref:perplexity",
    provider: "perplexity_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.74,
    docsUrl: "https://docs.perplexity.ai/guides/bots",
    patterns: [/^https?:\/\/(?:[^/]+\.)?perplexity\.ai(?:\/|$)/i],
  },
  {
    id: "ref:google:gemini",
    provider: "google_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.7,
    docsUrl: googleCommonCrawlersDocsUrl,
    patterns: [
      /^https?:\/\/gemini\.google\.com(?:\/|$)/i,
      /^https?:\/\/bard\.google\.com(?:\/|$)/i,
      /^https?:\/\/(?:[^/]+\.)?ai\.google(?:\/|$)/i,
    ],
  },
  {
    id: "ref:google:search",
    provider: "google_referral",
    agentType: "search_referral",
    confidence: 0.82,
    docsUrl: googleCommonCrawlersDocsUrl,
    patterns: [
      /^https?:\/\/(?:www\.)?google\.[^/]+\/(?:search|url)(?:[/?#]|$)/i,
    ],
  },
  {
    id: "ref:meta:ai",
    provider: "ai_browser_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.68,
    docsUrl: metaCrawlerDocsUrl,
    patterns: [/^https?:\/\/(?:www\.)?meta\.ai(?:\/|$)/i],
  },
  {
    id: "ref:generic-ai",
    provider: "ai_browser_referral",
    agentType: "ai_assistant_referral",
    confidence: 0.55,
    patterns: [
      /^https?:\/\/(?:[^/]+\.)?(?:copilot\.microsoft\.com|poe\.com|you\.com)(?:\/|$)/i,
    ],
  },
] as const;

export function classifyUserAgent(userAgent: unknown): AiTrafficClassification {
  const normalizedUserAgent = normalizeHeaderValue(userAgent);

  if (normalizedUserAgent === undefined) {
    return unknownClassification("fallback:unknown-user-agent");
  }

  return classifyByRules(
    normalizedUserAgent,
    userAgentRules,
    "user_agent",
    "fallback:unknown-user-agent",
  );
}

export function classifyReferer(referer: unknown): AiTrafficClassification {
  const normalizedReferer = normalizeHeaderValue(referer);

  if (normalizedReferer === undefined) {
    return unknownClassification("fallback:unknown-referer");
  }

  return classifyByRules(
    normalizedReferer,
    refererRules,
    "referer",
    "fallback:unknown-referer",
  );
}

export function classifyAiTraffic(
  requestLike: AiTrafficRequestLike,
): AiTrafficClassification {
  const userAgent = firstHeaderValue(
    requestLike.userAgent,
    headerValue(requestLike, "user-agent"),
  );
  const referer = firstHeaderValue(
    requestLike.referer,
    requestLike.referrer,
    headerValue(requestLike, "referer"),
    headerValue(requestLike, "referrer"),
  );

  const userAgentClassification = classifyUserAgent(userAgent);
  const refererClassification = classifyReferer(referer);

  if (
    isKnownClassification(userAgentClassification) &&
    userAgentClassification.confidence >= refererClassification.confidence
  ) {
    return userAgentClassification;
  }

  if (isKnownClassification(refererClassification)) {
    return refererClassification;
  }

  return unknownClassification("fallback:unknown-request");
}

export function toLiveAiTrafficProviderClassification(
  classification: AiTrafficClassification,
): LiveAiTrafficProviderClassification {
  return {
    provider: classification.provider,
    agentType: classification.agentType,
    confidence: classification.confidence,
    matchedBy: classification.matchedBy,
  };
}

export type LiveAiTrafficEvent = {
  schemaVersion: number;
  eventKind: "request_observation";
  sourceProvider: LiveAiTrafficSourceProvider;
  observedAt: string;
  request: {
    host: string;
    path: string;
    search?: string;
    method: LiveAiTrafficHttpMethod;
    userAgent?: string;
    referer?: string;
  };
  providerClassification: LiveAiTrafficProviderClassification;
  location?: {
    country?: string;
    region?: string;
  };
  ipHash?: {
    algorithm: LiveAiTrafficIpHashAlgorithm;
    value?: string;
    keyId?: string;
    truncatedBits?: number;
    originalIpRetention?: "not_collected" | "discarded_after_hash";
  };
  integration?: {
    name: string;
    requestId?: string;
  };
};

export const liveAiTrafficEventJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "promptscout.liveAiTrafficEvent",
  title: "PromptScout live AI traffic request observation",
  type: "object",
  required: [
    "schemaVersion",
    "eventKind",
    "sourceProvider",
    "observedAt",
    "request",
    "providerClassification",
  ],
  additionalProperties: true,
  properties: {
    schemaVersion: {
      type: "integer",
      minimum: LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION,
    },
    eventKind: {
      const: "request_observation",
    },
    sourceProvider: {
      type: "string",
      enum: liveAiTrafficSourceProviders,
    },
    observedAt: {
      type: "string",
      format: "date-time",
    },
    request: {
      type: "object",
      required: ["host", "path", "method"],
      additionalProperties: false,
      properties: {
        host: { type: "string", minLength: 1 },
        path: { type: "string", pattern: "^/" },
        search: { type: "string", pattern: "^(?:$|\\?)" },
        method: { type: "string", enum: liveAiTrafficHttpMethods },
        userAgent: { type: "string" },
        referer: { type: "string" },
      },
    },
    providerClassification: {
      type: "object",
      required: ["provider", "agentType", "confidence", "matchedBy"],
      additionalProperties: false,
      properties: {
        provider: {
          type: "string",
          enum: liveAiTrafficClassifiedProviders,
        },
        agentType: {
          type: "string",
          enum: liveAiTrafficAgentTypes,
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
        matchedBy: {
          type: "array",
          minItems: 1,
          items: { type: "string", enum: liveAiTrafficMatchKinds },
        },
      },
    },
    location: {
      type: "object",
      additionalProperties: false,
      properties: {
        country: { type: "string", pattern: "^[A-Z]{2}$" },
        region: { type: "string", minLength: 1 },
      },
    },
    ipHash: {
      type: "object",
      required: ["algorithm"],
      additionalProperties: false,
      properties: {
        algorithm: {
          type: "string",
          enum: liveAiTrafficIpHashAlgorithms,
        },
        value: { type: "string", minLength: 1 },
        keyId: { type: "string", minLength: 1 },
        truncatedBits: { type: "integer", minimum: 1 },
        originalIpRetention: {
          type: "string",
          enum: ["not_collected", "discarded_after_hash"],
        },
      },
    },
    integration: {
      type: "object",
      required: ["name"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        requestId: { type: "string", minLength: 1 },
      },
    },
  },
} as const;

class LiveAiTrafficEventValidationError extends Error {
  constructor(issues: string[]) {
    super(`Invalid live AI traffic event: ${issues.join("; ")}`);
    this.name = "LiveAiTrafficEventValidationError";
  }
}

export function parseLiveAiTrafficEvent(input: unknown): LiveAiTrafficEvent {
  const issues = validateLiveAiTrafficEvent(input);

  if (issues.length > 0) {
    throw new LiveAiTrafficEventValidationError(issues);
  }

  return input as LiveAiTrafficEvent;
}

export function isLiveAiTrafficEvent(
  input: unknown,
): input is LiveAiTrafficEvent {
  return validateLiveAiTrafficEvent(input).length === 0;
}

export function validateLiveAiTrafficEvent(input: unknown): string[] {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return ["event must be an object"];
  }

  requireInteger(input, "schemaVersion", issues);
  if (
    typeof input.schemaVersion === "number" &&
    input.schemaVersion < LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION
  ) {
    issues.push(
      `schemaVersion must be >= ${LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION}`,
    );
  }

  requireLiteral(input, "eventKind", "request_observation", issues);
  requireEnum(input, "sourceProvider", liveAiTrafficSourceProviders, issues);
  requireIsoDateTime(input, "observedAt", issues);
  validateRequest(input.request, issues);
  validateProviderClassification(input.providerClassification, issues);

  if (input.location !== undefined) {
    validateLocation(input.location, issues);
  }

  if (input.ipHash !== undefined) {
    validateIpHash(input.ipHash, issues);
  }

  if (input.integration !== undefined) {
    validateIntegration(input.integration, issues);
  }

  return issues;
}

function validateRequest(input: unknown, issues: string[]): void {
  if (!isRecord(input)) {
    issues.push("request must be an object");
    return;
  }

  rejectUnknownProperties(
    input,
    "request",
    ["host", "path", "search", "method", "userAgent", "referer"],
    issues,
  );
  requireString(input, "host", issues);
  requireString(input, "path", issues);
  if (typeof input.path === "string" && !input.path.startsWith("/")) {
    issues.push("request.path must start with /");
  }
  if (input.search !== undefined) {
    requireOptionalString(input, "search", issues);
    if (
      typeof input.search === "string" &&
      input.search.length > 0 &&
      !input.search.startsWith("?")
    ) {
      issues.push("request.search must be empty or start with ?");
    }
  }
  requireEnum(input, "method", liveAiTrafficHttpMethods, issues);
  requireOptionalString(input, "userAgent", issues);
  requireOptionalString(input, "referer", issues);
}

function validateProviderClassification(
  input: unknown,
  issues: string[],
): void {
  if (!isRecord(input)) {
    issues.push("providerClassification must be an object");
    return;
  }

  rejectUnknownProperties(
    input,
    "providerClassification",
    ["provider", "agentType", "confidence", "matchedBy"],
    issues,
  );
  requireEnum(input, "provider", liveAiTrafficClassifiedProviders, issues);
  requireEnum(input, "agentType", liveAiTrafficAgentTypes, issues);
  requireNumber(input, "confidence", issues);
  if (
    typeof input.confidence === "number" &&
    (input.confidence < 0 || input.confidence > 1)
  ) {
    issues.push("providerClassification.confidence must be between 0 and 1");
  }
  if (!Array.isArray(input.matchedBy) || input.matchedBy.length === 0) {
    issues.push("providerClassification.matchedBy must be a non-empty array");
    return;
  }

  for (const [index, value] of input.matchedBy.entries()) {
    if (!isEnumValue(value, liveAiTrafficMatchKinds)) {
      issues.push(`providerClassification.matchedBy[${index}] is invalid`);
    }
  }
}

function validateLocation(input: unknown, issues: string[]): void {
  if (!isRecord(input)) {
    issues.push("location must be an object");
    return;
  }

  rejectUnknownProperties(input, "location", ["country", "region"], issues);
  requireOptionalString(input, "country", issues);
  if (typeof input.country === "string" && !/^[A-Z]{2}$/.test(input.country)) {
    issues.push("location.country must be an ISO 3166-1 alpha-2 code");
  }
  requireOptionalNonEmptyString(input, "region", issues);
}

function validateIpHash(input: unknown, issues: string[]): void {
  if (!isRecord(input)) {
    issues.push("ipHash must be an object");
    return;
  }

  rejectUnknownProperties(
    input,
    "ipHash",
    ["algorithm", "value", "keyId", "truncatedBits", "originalIpRetention"],
    issues,
  );
  requireEnum(input, "algorithm", liveAiTrafficIpHashAlgorithms, issues);
  requireOptionalNonEmptyString(input, "value", issues);
  requireOptionalNonEmptyString(input, "keyId", issues);
  if (input.truncatedBits !== undefined) {
    requireInteger(input, "truncatedBits", issues);
    if (typeof input.truncatedBits === "number" && input.truncatedBits < 1) {
      issues.push("ipHash.truncatedBits must be >= 1");
    }
  }
  if (
    input.originalIpRetention !== undefined &&
    input.originalIpRetention !== "not_collected" &&
    input.originalIpRetention !== "discarded_after_hash"
  ) {
    issues.push("ipHash.originalIpRetention is invalid");
  }
}

function validateIntegration(input: unknown, issues: string[]): void {
  if (!isRecord(input)) {
    issues.push("integration must be an object");
    return;
  }

  rejectUnknownProperties(input, "integration", ["name", "requestId"], issues);
  requireString(input, "name", issues);
  requireOptionalNonEmptyString(input, "requestId", issues);
}

function classifyByRules(
  value: string,
  rules: readonly ClassificationRule[],
  matchedBy: LiveAiTrafficMatchKind,
  fallbackRule: string,
): AiTrafficClassification {
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(value))) {
      return {
        provider: rule.provider,
        agentType: rule.agentType,
        confidence: rule.confidence,
        matchedRule: rule.id,
        matchedBy: [matchedBy],
        ...(rule.docsUrl === undefined ? {} : { docsUrl: rule.docsUrl }),
      };
    }
  }

  return unknownClassification(fallbackRule);
}

function unknownClassification(matchedRule: string): AiTrafficClassification {
  return {
    provider: "other",
    agentType: "other",
    confidence: 0,
    matchedRule,
    matchedBy: ["other"],
  };
}

function isKnownClassification(
  classification: AiTrafficClassification,
): boolean {
  return (
    classification.provider !== "other" && classification.agentType !== "other"
  );
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

function firstHeaderValue(...inputs: unknown[]): string | undefined {
  for (const input of inputs) {
    const normalizedValue = normalizeHeaderValue(input);
    if (normalizedValue !== undefined) {
      return normalizedValue;
    }
  }

  return undefined;
}

function headerValue(
  requestLike: AiTrafficRequestLike,
  headerName: string,
): unknown {
  const headers = requestLike.headers;

  if (!isRecord(headers)) {
    return undefined;
  }

  if (typeof headers.get === "function") {
    return headers.get(headerName);
  }

  const lowerHeaderName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerHeaderName) {
      return value;
    }
  }

  return undefined;
}

function requireString(
  input: Record<string, unknown>,
  field: string,
  issues: string[],
): void {
  if (typeof input[field] !== "string" || input[field].length === 0) {
    issues.push(`${field} must be a non-empty string`);
  }
}

function requireOptionalString(
  input: Record<string, unknown>,
  field: string,
  issues: string[],
): void {
  if (input[field] !== undefined && typeof input[field] !== "string") {
    issues.push(`${field} must be a string when present`);
  }
}

function requireOptionalNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  issues: string[],
): void {
  if (input[field] === undefined) {
    return;
  }

  requireString(input, field, issues);
}

function requireNumber(
  input: Record<string, unknown>,
  field: string,
  issues: string[],
): void {
  if (typeof input[field] !== "number" || !Number.isFinite(input[field])) {
    issues.push(`${field} must be a finite number`);
  }
}

function requireInteger(
  input: Record<string, unknown>,
  field: string,
  issues: string[],
): void {
  if (!Number.isInteger(input[field])) {
    issues.push(`${field} must be an integer`);
  }
}

function requireLiteral(
  input: Record<string, unknown>,
  field: string,
  expected: string,
  issues: string[],
): void {
  if (input[field] !== expected) {
    issues.push(`${field} must be ${expected}`);
  }
}

function requireEnum<T extends readonly string[]>(
  input: Record<string, unknown>,
  field: string,
  allowedValues: T,
  issues: string[],
): void {
  if (!isEnumValue(input[field], allowedValues)) {
    issues.push(`${field} must be one of ${allowedValues.join(", ")}`);
  }
}

function requireIsoDateTime(
  input: Record<string, unknown>,
  field: string,
  issues: string[],
): void {
  if (typeof input[field] !== "string") {
    issues.push(`${field} must be an ISO timestamp`);
    return;
  }

  if (!isStrictIsoDateTime(input[field])) {
    issues.push(`${field} must be an ISO date-time timestamp`);
    return;
  }

  const parsed = Date.parse(input[field]);
  if (!Number.isFinite(parsed)) {
    issues.push(`${field} must be an ISO date-time timestamp`);
  }
}

function isStrictIsoDateTime(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) {
    return false;
  }

  const [
    ,
    yearValue,
    monthValue,
    dayValue,
    hourValue,
    minuteValue,
    secondValue,
    offsetHourValue,
    offsetMinuteValue,
  ] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const offsetHour =
    offsetHourValue === undefined ? 0 : Number(offsetHourValue);
  const offsetMinute =
    offsetMinuteValue === undefined ? 0 : Number(offsetMinuteValue);

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function rejectUnknownProperties(
  input: Record<string, unknown>,
  objectName: string,
  allowedFields: readonly string[],
  issues: string[],
): void {
  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) {
      issues.push(`${objectName}.${field} is not allowed`);
    }
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isEnumValue<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
): value is T[number] {
  return (
    typeof value === "string" &&
    (allowedValues as readonly string[]).includes(value)
  );
}
