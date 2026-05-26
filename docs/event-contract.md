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
  `anthropic_claudebot`, `perplexitybot`, `google_crawler`,
  `google_referral`, `ai_browser_referral`, or `other`.
- `providerClassification.agentType`: known traffic class, such as
  `ai_search_crawler`, `ai_training_crawler`, `ai_browser_user`,
  `ai_assistant_referral`, `search_crawler`, `search_referral`, or `other`.
- `providerClassification.confidence`: number from `0` through `1`.
- `providerClassification.matchedBy`: non-empty list of signals used to classify
  the event, such as `user_agent`, `referer`, `host`, `path`, `manual`, or
  `other`.

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

Committed fixtures live under `packages/core/fixtures/accepted` and
`packages/core/fixtures/rejected`. The focused Node test validates those fixtures
against the exported parser and JSON schema metadata.
