import {
  normalizeQueryAttributionValue,
  openAiQueryAttributionNormalizedValues,
} from "./query_attribution.js";

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
export const LIVE_AI_TRAFFIC_SETUP_PROBE_SCHEMA_VERSION = 1;
export const PROMPTSCOUT_SETUP_PROBE_PATH = "/__promptscout/setup-probe";
export const PROMPTSCOUT_SETUP_PROBE_HEADER = "x-promptscout-setup-probe";
export const PROMPTSCOUT_SETUP_PROBE_ID_HEADER = "x-promptscout-probe-id";
export const PROMPTSCOUT_SETUP_PROBE_TOKEN_HEADER = "x-promptscout-probe-token";

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

export const liveAiTrafficIntegrationKinds = [
  "vercel_nextjs_middleware",
  "cloudflare_worker",
  "netlify_edge",
  "fastly_compute",
  "cloudfront_aws_realtime_logs",
  "nginx_log_forwarder",
  "wordpress_plugin",
  "node_express",
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
  "anthropic_claude_referral",
  "perplexitybot",
  "perplexity_user",
  "perplexity_referral",
  "google_crawler",
  "google_agent",
  "google_notebooklm",
  "google_gemini_referral",
  "google_referral",
  "microsoft_copilot_referral",
  "openai_chatgpt_referral",
  "meta_ai_referral",
  "meta_external_agent",
  "meta_external_fetcher",
  "xai_grok_referral",
  "mistral_le_chat_referral",
  "bytedance_bytespider",
  "ai_browser_referral",
  "other",
] as const;

export const liveAiTrafficAgentTypes = [
  "ai_search_crawler",
  "ai_training_crawler",
  "ai_browser_user",
  "ai_referral_visit",
  "link_preview",
  "ai_assistant_referral",
  "search_crawler",
  "search_referral",
  "other",
] as const;

export const liveAiTrafficProviderBuckets = [
  { id: "openai_chatgpt", label: "OpenAI / ChatGPT" },
  { id: "anthropic_claude", label: "Anthropic / Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "google_gemini", label: "Google / Gemini" },
  { id: "microsoft_copilot", label: "Microsoft Copilot" },
  { id: "meta_ai", label: "Meta AI" },
  { id: "xai_grok", label: "xAI / Grok" },
  { id: "mistral_le_chat", label: "Mistral / Le Chat" },
  { id: "other", label: "Other" },
] as const;

export const liveAiTrafficSignalFamilies = [
  { id: "ai_bot_visit", label: "AI bot or fetcher visit" },
  { id: "ai_referral_visit", label: "AI assistant referral visit" },
  { id: "search_baseline", label: "Search baseline" },
  { id: "other", label: "Other" },
] as const;

export const liveAiTrafficIntegrationOrigins = [
  {
    kind: "vercel_nextjs_middleware",
    sourceProvider: "vercel",
    label: "Vercel / Next.js middleware",
  },
  {
    kind: "cloudflare_worker",
    sourceProvider: "cloudflare",
    label: "Cloudflare Worker",
  },
  {
    kind: "netlify_edge",
    sourceProvider: "netlify",
    label: "Netlify Edge Function",
  },
  {
    kind: "fastly_compute",
    sourceProvider: "fastly",
    label: "Fastly Compute",
  },
  {
    kind: "cloudfront_aws_realtime_logs",
    sourceProvider: "cloudfront_aws",
    label: "CloudFront / AWS real-time logs",
  },
  {
    kind: "nginx_log_forwarder",
    sourceProvider: "nginx_log_forwarder",
    label: "nginx log forwarder",
  },
  {
    kind: "wordpress_plugin",
    sourceProvider: "wordpress",
    label: "WordPress plugin",
  },
  {
    kind: "node_express",
    sourceProvider: "node_express",
    label: "Node / Express middleware",
  },
  { kind: "manual", sourceProvider: "manual", label: "Manual import" },
  { kind: "other", sourceProvider: "other", label: "Other" },
] as const satisfies readonly {
  kind: LiveAiTrafficIntegrationKind;
  sourceProvider: LiveAiTrafficSourceProvider;
  label: string;
}[];

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
  "query",
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
export type LiveAiTrafficIntegrationKind =
  (typeof liveAiTrafficIntegrationKinds)[number];
export type LiveAiTrafficClassifiedProvider =
  (typeof liveAiTrafficClassifiedProviders)[number];
export type LiveAiTrafficAgentType = (typeof liveAiTrafficAgentTypes)[number];
export type LiveAiTrafficProviderBucket =
  (typeof liveAiTrafficProviderBuckets)[number]["id"];
export type LiveAiTrafficSignalFamily =
  (typeof liveAiTrafficSignalFamilies)[number]["id"];
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
  search?: unknown;
  query?: unknown;
  url?: unknown;
  landingUrl?: unknown;
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
const chatGptGeneratedLinksDocsUrl =
  "https://help.openai.com/en/articles/10984597-chatgpt-generated-links";
const claudeSharingDocsUrl =
  "https://support.claude.com/en/articles/10593882-sharing-and-unsharing-chats";
const perplexityCrawlersDocsUrl =
  "https://docs.perplexity.ai/docs/resources/perplexity-crawlers";
const geminiSharingDocsUrl =
  "https://support.google.com/gemini/answer/13743730";
const microsoftCopilotDocsUrl =
  "https://support.microsoft.com/en-us/microsoft-365-copilot/what-s-the-difference-between-microsoft-copilot-free-and-copilot-in-microsoft-365";
const metaCrawlerDocsUrl =
  "https://developers.facebook.com/docs/sharing/webmasters/crawler";
const metaAiDocsUrl = "https://www.meta.ai/";
const xaiGrokDocsUrl = "https://x.ai/grok";
const mistralLeChatDocsUrl = "https://docs.mistral.ai/le-chat";

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
    provider: "openai_chatgpt_referral",
    agentType: "ai_referral_visit",
    confidence: 0.78,
    docsUrl: chatGptGeneratedLinksDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?chatgpt\.com(?:\/|$)/i],
  },
  {
    id: "ref:openai",
    provider: "ai_browser_referral",
    agentType: "ai_referral_visit",
    confidence: 0.7,
    docsUrl: openAiBotsDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?openai\.com(?:\/|$)/i],
  },
  {
    id: "ref:anthropic:claude",
    provider: "anthropic_claude_referral",
    agentType: "ai_referral_visit",
    confidence: 0.72,
    docsUrl: claudeSharingDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?claude\.ai(?:\/|$)/i],
  },
  {
    id: "ref:perplexity",
    provider: "perplexity_referral",
    agentType: "ai_referral_visit",
    confidence: 0.74,
    docsUrl: perplexityCrawlersDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?perplexity\.ai(?:\/|$)/i],
  },
  {
    id: "ref:google:gemini",
    provider: "google_gemini_referral",
    agentType: "ai_referral_visit",
    confidence: 0.7,
    docsUrl: geminiSharingDocsUrl,
    patterns: [
      /^https?:\/\/gemini\.google\.com(?:\/|$)/i,
      /^https?:\/\/bard\.google\.com(?:\/|$)/i,
      /^https?:\/\/(?:[^/]+\.)?ai\.google(?:\/|$)/i,
    ],
  },
  {
    id: "ref:microsoft:copilot",
    provider: "microsoft_copilot_referral",
    agentType: "ai_referral_visit",
    confidence: 0.7,
    docsUrl: microsoftCopilotDocsUrl,
    patterns: [
      /^https?:\/\/copilot\.microsoft\.com(?:\/|$)/i,
      /^https?:\/\/(?:www\.)?bing\.com\/chat(?:[/?#]|$)/i,
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
    provider: "meta_ai_referral",
    agentType: "ai_referral_visit",
    confidence: 0.68,
    docsUrl: metaAiDocsUrl,
    patterns: [/^https?:\/\/(?:www\.)?meta\.ai(?:\/|$)/i],
  },
  {
    id: "ref:xai:grok",
    provider: "xai_grok_referral",
    agentType: "ai_referral_visit",
    confidence: 0.68,
    docsUrl: xaiGrokDocsUrl,
    patterns: [/^https?:\/\/(?:[^/]+\.)?grok\.com(?:\/|$)/i],
  },
  {
    id: "ref:mistral:le-chat",
    provider: "mistral_le_chat_referral",
    agentType: "ai_referral_visit",
    confidence: 0.68,
    docsUrl: mistralLeChatDocsUrl,
    patterns: [/^https?:\/\/chat\.mistral\.ai(?:\/|$)/i],
  },
  {
    id: "ref:generic-ai",
    provider: "ai_browser_referral",
    agentType: "ai_referral_visit",
    confidence: 0.55,
    patterns: [
      /^https?:\/\/(?:[^/]+\.)?(?:copilot\.microsoft\.com|poe\.com|you\.com)(?:\/|$)/i,
    ],
  },
] as const;

const landingQueryAttributionRules: readonly ClassificationRule[] = [
  {
    id: "query:openai:chatgpt",
    provider: "openai_chatgpt_referral",
    agentType: "ai_referral_visit",
    confidence: 0.68,
    docsUrl: chatGptGeneratedLinksDocsUrl,
    patterns: [
      new RegExp(
        `^(?:${openAiQueryAttributionNormalizedValues.join("|")})$`,
        "i",
      ),
    ],
  },
] as const;

const landingQueryAttributionKeys = new Set(["utm_source", "source"]);

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

export function classifyLandingQuery(
  queryLike: unknown,
): AiTrafficClassification {
  const search = normalizeSearchValue(queryLike);

  if (search === undefined) {
    return unknownClassification("fallback:unknown-query");
  }

  for (const [key, value] of searchParams(search)) {
    if (!landingQueryAttributionKeys.has(key.toLowerCase())) {
      continue;
    }

    const normalizedValue = normalizeQueryAttributionValue(value);
    const classification = classifyByRules(
      normalizedValue,
      landingQueryAttributionRules,
      "query",
      "fallback:unknown-query",
    );

    if (isKnownClassification(classification)) {
      return classification;
    }
  }

  return unknownClassification("fallback:unknown-query");
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
  const landingQuery = firstHeaderValue(
    requestLike.search,
    requestLike.query,
    requestLike.url,
    requestLike.landingUrl,
  );

  const userAgentClassification = classifyUserAgent(userAgent);
  const refererClassification = classifyReferer(referer);
  const queryClassification = classifyLandingQuery(landingQuery);
  const knownClassifications = [
    userAgentClassification,
    refererClassification,
    queryClassification,
  ].filter(isKnownClassification);

  if (knownClassifications.length > 0) {
    return knownClassifications.reduce((selected, candidate) =>
      candidate.confidence > selected.confidence ? candidate : selected,
    );
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

export function getLiveAiTrafficProviderBucket(
  provider: LiveAiTrafficClassifiedProvider,
): LiveAiTrafficProviderBucket {
  switch (provider) {
    case "openai_search_bot":
    case "openai_gptbot":
    case "openai_chatgpt_user":
    case "openai_chatgpt_referral":
      return "openai_chatgpt";
    case "anthropic_claudebot":
    case "anthropic_claude_search_bot":
    case "anthropic_claude_user":
    case "anthropic_claude_referral":
      return "anthropic_claude";
    case "perplexitybot":
    case "perplexity_user":
    case "perplexity_referral":
      return "perplexity";
    case "google_agent":
    case "google_notebooklm":
    case "google_gemini_referral":
      return "google_gemini";
    case "microsoft_copilot_referral":
      return "microsoft_copilot";
    case "meta_ai_referral":
    case "meta_external_agent":
    case "meta_external_fetcher":
      return "meta_ai";
    case "xai_grok_referral":
      return "xai_grok";
    case "mistral_le_chat_referral":
      return "mistral_le_chat";
    default:
      return "other";
  }
}

export function getLiveAiTrafficSignalFamily(
  agentType: LiveAiTrafficAgentType,
): LiveAiTrafficSignalFamily {
  switch (agentType) {
    case "ai_search_crawler":
    case "ai_training_crawler":
    case "ai_browser_user":
    case "link_preview":
      return "ai_bot_visit";
    case "ai_referral_visit":
    case "ai_assistant_referral":
      return "ai_referral_visit";
    case "search_crawler":
    case "search_referral":
      return "search_baseline";
    default:
      return "other";
  }
}

export function getLiveAiTrafficIntegrationOrigin(
  kind: unknown,
): (typeof liveAiTrafficIntegrationOrigins)[number] {
  if (typeof kind !== "string") {
    return liveAiTrafficIntegrationOrigins[
      liveAiTrafficIntegrationOrigins.length - 1
    ];
  }

  return (
    liveAiTrafficIntegrationOrigins.find((origin) => origin.kind === kind) ??
    liveAiTrafficIntegrationOrigins[liveAiTrafficIntegrationOrigins.length - 1]
  );
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
    kind?: LiveAiTrafficIntegrationKind;
    name: string;
    version?: string;
    requestId?: string;
  };
};

export type LiveAiTrafficSetupProbeEvent = {
  schemaVersion: number;
  eventKind: "setup_probe";
  sourceProvider: LiveAiTrafficSourceProvider;
  observedAt: string;
  probe: {
    id: string;
    token: string;
  };
  request: {
    host: string;
    path: string;
    search?: string;
    method: LiveAiTrafficHttpMethod;
    userAgent?: string;
    referer?: string;
  };
  integration?: {
    kind?: LiveAiTrafficIntegrationKind;
    name: string;
    version?: string;
    requestId?: string;
  };
};

export type LiveAiTrafficSetupProbeResponse = {
  ok: boolean;
  eventKind: "setup_probe";
  probeId: string;
  receivedAt: string;
};

export type CreateLiveAiTrafficSetupProbeEventInput = Omit<
  LiveAiTrafficSetupProbeEvent,
  "schemaVersion" | "eventKind" | "observedAt"
> & {
  observedAt?: string;
  now?: () => Date;
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
        kind: { type: "string", enum: liveAiTrafficIntegrationKinds },
        name: { type: "string", minLength: 1 },
        version: { type: "string", minLength: 1 },
        requestId: { type: "string", minLength: 1 },
      },
    },
  },
} as const;

export const liveAiTrafficSetupProbeEventJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "promptscout.liveAiTrafficSetupProbeEvent",
  title: "PromptScout live AI traffic setup probe",
  type: "object",
  required: [
    "schemaVersion",
    "eventKind",
    "sourceProvider",
    "observedAt",
    "probe",
    "request",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: "integer",
      minimum: LIVE_AI_TRAFFIC_SETUP_PROBE_SCHEMA_VERSION,
    },
    eventKind: {
      const: "setup_probe",
    },
    sourceProvider: {
      type: "string",
      enum: liveAiTrafficSourceProviders,
    },
    observedAt: {
      type: "string",
      format: "date-time",
    },
    probe: {
      type: "object",
      required: ["id", "token"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        token: { type: "string", minLength: 1 },
      },
    },
    request: liveAiTrafficEventJsonSchema.properties.request,
    integration: liveAiTrafficEventJsonSchema.properties.integration,
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

export function createLiveAiTrafficSetupProbeEvent(
  input: CreateLiveAiTrafficSetupProbeEventInput,
): LiveAiTrafficSetupProbeEvent {
  return parseLiveAiTrafficSetupProbeEvent({
    schemaVersion: LIVE_AI_TRAFFIC_SETUP_PROBE_SCHEMA_VERSION,
    eventKind: "setup_probe",
    sourceProvider: input.sourceProvider,
    observedAt: input.observedAt ?? (input.now?.() ?? new Date()).toISOString(),
    probe: input.probe,
    request: input.request,
    ...(input.integration === undefined
      ? {}
      : { integration: input.integration }),
  });
}

export function isPromptScoutSetupProbePath(path: unknown): boolean {
  return path === PROMPTSCOUT_SETUP_PROBE_PATH;
}

export function isPromptScoutSetupProbeHeaderValue(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function parseLiveAiTrafficSetupProbeEvent(
  input: unknown,
): LiveAiTrafficSetupProbeEvent {
  const issues = validateLiveAiTrafficSetupProbeEvent(input);

  if (issues.length > 0) {
    throw new LiveAiTrafficEventValidationError(issues);
  }

  return input as LiveAiTrafficSetupProbeEvent;
}

export function isLiveAiTrafficSetupProbeEvent(
  input: unknown,
): input is LiveAiTrafficSetupProbeEvent {
  return validateLiveAiTrafficSetupProbeEvent(input).length === 0;
}

export function validateLiveAiTrafficSetupProbeEvent(input: unknown): string[] {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return ["setup probe event must be an object"];
  }

  rejectUnknownProperties(
    input,
    "event",
    [
      "schemaVersion",
      "eventKind",
      "sourceProvider",
      "observedAt",
      "probe",
      "request",
      "integration",
    ],
    issues,
  );
  requireInteger(input, "schemaVersion", issues);
  if (
    typeof input.schemaVersion === "number" &&
    input.schemaVersion < LIVE_AI_TRAFFIC_SETUP_PROBE_SCHEMA_VERSION
  ) {
    issues.push(
      `schemaVersion must be >= ${LIVE_AI_TRAFFIC_SETUP_PROBE_SCHEMA_VERSION}`,
    );
  }

  requireLiteral(input, "eventKind", "setup_probe", issues);
  requireEnum(input, "sourceProvider", liveAiTrafficSourceProviders, issues);
  requireIsoDateTime(input, "observedAt", issues);
  validateProbe(input.probe, issues);
  validateRequest(input.request, issues);

  if (input.integration !== undefined) {
    validateIntegration(input.integration, issues);
  }

  return issues;
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

function validateProbe(input: unknown, issues: string[]): void {
  if (!isRecord(input)) {
    issues.push("probe must be an object");
    return;
  }

  rejectUnknownProperties(input, "probe", ["id", "token"], issues);
  requireString(input, "id", issues);
  requireString(input, "token", issues);
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

  rejectUnknownProperties(
    input,
    "integration",
    ["kind", "name", "version", "requestId"],
    issues,
  );
  if (input.kind !== undefined) {
    requireEnum(input, "kind", liveAiTrafficIntegrationKinds, issues);
  }
  requireString(input, "name", issues);
  requireOptionalNonEmptyString(input, "version", issues);
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

  if (isRecord(input) && typeof input.href === "string") {
    return normalizeHeaderValue(input.href);
  }

  if (typeof input !== "string") {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSearchValue(input: unknown): string | undefined {
  const value = normalizeHeaderValue(input);

  if (value === undefined) {
    return undefined;
  }

  if (value.startsWith("?")) {
    return value;
  }

  const queryIndex = value.indexOf("?");
  if (queryIndex >= 0) {
    return value.slice(queryIndex);
  }

  return `?${value}`;
}

function searchParams(search: string): [string, string][] {
  const body = search.startsWith("?") ? search.slice(1) : search;
  const params: [string, string][] = [];

  for (const pair of body.split("&")) {
    if (pair.length === 0) {
      continue;
    }

    const equalsIndex = pair.indexOf("=");
    const rawKey = equalsIndex >= 0 ? pair.slice(0, equalsIndex) : pair;
    const rawValue = equalsIndex >= 0 ? pair.slice(equalsIndex + 1) : "";
    params.push([decodeFormComponent(rawKey), decodeFormComponent(rawValue)]);
  }

  return params;
}

function decodeFormComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
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
