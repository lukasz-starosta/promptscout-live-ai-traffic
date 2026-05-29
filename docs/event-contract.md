# Live AI Traffic Event Contract

`packages/core` owns the canonical request-level event contract shared by
collectors and the PromptScout ingest endpoint. These events are analytics
observations about traffic that reached a site. They are not proof that a
ChatGPT answer, Claude answer, Perplexity answer, or Google result mentioned the
brand or page.

The current schema version is `1`. Parsers must reject version `0` and malformed
version values. Parsers may accept future numeric versions when all known
version `1` fields remain valid, so new producers can add non-critical extension
fields without breaking older consumers.

## Required Fields

- `schemaVersion`: numeric schema version, currently `1`.
- `eventKind`: always `request_observation`.
- `sourceProvider`: collector or edge integration that observed the request.
  Use a known value such as `vercel`, `cloudflare`, `netlify`,
  `nginx_log_forwarder`, `wordpress`, `node_express`, `cloudfront_aws`,
  `fastly`, `manual`, or explicitly map unsupported sources to `other`.
- `observedAt`: ISO timestamp for when the collector observed the request.
- `request.host`: request host.
- `request.path`: request path, starting with `/`.
- `request.method`: uppercase HTTP method or `OTHER`.
- `providerClassification.provider`: known provider classification, such as
  `openai_search_bot`, `openai_gptbot`, `openai_chatgpt_user`,
  `anthropic_claudebot`, `anthropic_claude_search_bot`,
  `anthropic_claude_user`, `anthropic_claude_referral`, `perplexitybot`,
  `perplexity_user`, `perplexity_referral`, `google_crawler`,
  `google_agent`, `google_notebooklm`, `google_gemini_referral`,
  `google_referral`, `microsoft_copilot_referral`,
  `openai_chatgpt_referral`, `meta_external_agent`, `meta_external_fetcher`,
  `bytedance_bytespider`, `ai_browser_referral`, or `other`.
- `providerClassification.agentType`: known traffic class, such as
  `ai_search_crawler`, `ai_training_crawler`, `ai_browser_user`,
  `ai_referral_visit`, `link_preview`, `ai_assistant_referral`,
  `search_crawler`, `search_referral`, or `other`.
- `providerClassification.confidence`: number from `0` through `1`.
- `providerClassification.matchedBy`: non-empty list of signals used to classify
  the event, such as `user_agent`, `referer`, `query`, `host`, `path`,
  `manual`, or `other`.

Unknown critical enum values must not be silently accepted. Collectors should
map uncertain or unsupported values to `other` before sending the event, then
preserve any integration-specific raw details outside the canonical fields.

## Optional Fields

- `request.search`: query string. Use an empty string or a value starting with
  `?`.
- `request.userAgent`: request user agent when available.
- `request.referer`: request referer when available.
- `location.country`: ISO 3166-1 alpha-2 country code when available.
- `location.region`: region, state, province, or edge-provided subdivision when
  available.
- `ipHash`: privacy-safe IP hash metadata. `algorithm` is required when this
  object is present. `value`, `keyId`, `truncatedBits`, and
  `originalIpRetention` describe how the hash was produced without storing the
  raw IP address.

## Integration-Specific Fields

- `integration.name`: collector implementation name.
- `integration.requestId`: platform request identifier when available.
- Future top-level extension fields are allowed for forward compatibility.
  Consumers must not treat those extension fields as part of the stable v1
  contract until they are promoted into `packages/core`.

## Implementation

`packages/core/src/index.ts` exports:

- `LIVE_AI_TRAFFIC_EVENT_SCHEMA_VERSION`
- `LiveAiTrafficEvent`
- `liveAiTrafficEventJsonSchema`
- `parseLiveAiTrafficEvent`
- `isLiveAiTrafficEvent`
- `validateLiveAiTrafficEvent`
- `classifyAiTraffic(requestLike)`
- `classifyUserAgent(userAgent)`
- `classifyReferer(referer)`
- `classifyLandingQuery(queryLike)`
- `toLiveAiTrafficProviderClassification(classification)`
- `createLiveAiTrafficIngestClient(options)`
- `normalizeLiveAiTrafficEvent(event, privacyOptions)`
- `hashLiveAiTrafficIp(ipAddress, options)`
- `filterLiveAiTrafficHeaders(headers, allowlist)`
- `createLiveAiTrafficBatcher(options)`
- `deliverLiveAiTrafficEvent(options)`

The ingest client uses `fetch` and optional Web Crypto HMAC signing so provider
packages can run in Node, edge, or log-forwarder environments without importing
PromptScout-side secrets or Supabase keys. Privacy helpers let adapters hash or
omit IP addresses, redact paths, allowlist query parameters, and keep only
explicitly allowed request headers before sending events.

## Classification Helpers

`classifyAiTraffic(requestLike)` is the shared classifier that provider
packages should call before building a request observation event. It accepts a
small request-like object with `userAgent`, `referer`/`referrer`,
`search`/`query`/`url`/`landingUrl`, or a case-insensitive `headers` object.
Provider packages should not duplicate crawler string matching.

Landing URL query attribution is intentionally narrow. The classifier currently
inspects source-style query keys such as `utm_source` and `source` for known
ChatGPT source values such as `chatgpt.com`, `chatgpt`, `chat.openai.com`, and
normalized equivalents. Query attribution returns `matchedBy: ["query"]`; it
must not be reported as `referer`. It is an advisory referral signal and should
not override higher-confidence bot or user-fetch user-agent matches.

The lower-level helpers return the same shape:

- `provider`: the canonical provider classification, or `other`.
- `agentType`: the traffic class.
- `confidence`: a `0` through `1` score for the matched signal.
- `matchedRule`: the registry rule identifier, such as
  `ua:openai:oai-searchbot`, `ref:perplexity`, or
  `query:openai:chatgpt`.
- `matchedBy`: the signal type used for classification.
- `docsUrl`: provider documentation when the rule has a useful public source.

Classifier results include registry metadata for debugging and docs links. Before
placing a classifier result on `LiveAiTrafficEvent.providerClassification`, call
`toLiveAiTrafficProviderClassification(classification)` so the event only
contains the closed contract fields: `provider`, `agentType`, `confidence`, and
`matchedBy`.

Agent types intentionally distinguish the traffic purpose:

- `ai_search_crawler`: automated AI search/indexing crawler, such as
  OpenAI `OAI-SearchBot`, Anthropic `Claude-SearchBot`, or PerplexityBot.
- `ai_training_crawler`: crawler primarily associated with model or product data
  collection, such as OpenAI `GPTBot`, Anthropic `ClaudeBot`,
  Meta-ExternalAgent, or Bytespider.
- `ai_browser_user`: user-triggered AI fetch, such as OpenAI `ChatGPT-User`,
  Anthropic `Claude-User`, Perplexity-User, Google-Agent, or NotebookLM.
- `ai_referral_visit`: a normal browser visit referred by an AI chat or answer
  surface, such as ChatGPT, Claude, Perplexity, Gemini, or Copilot. These are
  advisory referral signals and are separate from crawler/user-agent fetches.
- `link_preview`: preview/unfurl fetches, such as Meta/Facebook preview agents.
- `ai_assistant_referral`: legacy referral label retained in the schema for
  compatibility with older collectors; new classifier output should use
  `ai_referral_visit`.
- `search_crawler` and `search_referral`: conventional Google crawler or search
  referral traffic that is useful as a baseline next to AI traffic.
- `other`: explicit fallback for missing, malformed, or unsupported signals.

Committed fixtures live under `packages/core/fixtures/accepted` and
`packages/core/fixtures/rejected`. Classifier fixtures live under
`packages/core/fixtures/classifier`. The focused Node tests validate those
fixtures against the exported parser, classifier, and JSON schema metadata.
Classifier evidence, crawler source links, and confidence label rules are
documented in [docs/evidence.md](evidence.md).
