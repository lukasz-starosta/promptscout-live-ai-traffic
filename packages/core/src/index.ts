export type PlaceholderIntegration = {
  provider: string;
  status: "placeholder";
  notes: string;
};

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
  "perplexitybot",
  "google_crawler",
  "google_referral",
  "ai_browser_referral",
  "other",
] as const;

export const liveAiTrafficAgentTypes = [
  "ai_search_crawler",
  "ai_training_crawler",
  "ai_browser_user",
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
  providerClassification: {
    provider: LiveAiTrafficClassifiedProvider;
    agentType: LiveAiTrafficAgentType;
    confidence: number;
    matchedBy: LiveAiTrafficMatchKind[];
  };
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
    requireString(input, "search", issues);
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

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      input[field],
    )
  ) {
    issues.push(`${field} must be an ISO date-time timestamp`);
    return;
  }

  const parsed = Date.parse(input[field]);
  if (!Number.isFinite(parsed)) {
    issues.push(`${field} must be an ISO date-time timestamp`);
  }
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
