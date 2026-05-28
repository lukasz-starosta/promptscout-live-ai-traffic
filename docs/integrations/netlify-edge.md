# Netlify Edge Collector

`promptscout-live-ai-traffic-netlify-edge` is a customer-owned edge collector
for Netlify-hosted sites. It observes each matching edge request, classifies
traffic with `packages/core`, sends a request observation to PromptScout in the
background with `context.waitUntil()` when available, and returns
`context.next()` so the normal Netlify request chain continues.

The import below uses `promptscout-live-ai-traffic-netlify-edge`, a repo-local
private workspace package. It is not published as a separate npm package and is
not exported from `@promptscout/live-ai-traffic` yet. Treat this guide as a
repository-local example until a public collector subpath is added.

## Environment Variables

Configure these variables in Netlify with a Functions runtime scope:

- `PROMPTSCOUT_INGEST_TOKEN`: site-scoped ingest token. Store this as a secret.
- `PROMPTSCOUT_INGEST_URL`: PromptScout live AI traffic ingest endpoint.
- `PROMPTSCOUT_QUERY_POLICY`: optional query privacy policy. Supported values
  are `keep`, `omit`, and `allowlist`. Defaults to `omit`.
- `PROMPTSCOUT_QUERY_ALLOWLIST`: comma-separated query keys to keep. Setting
  this without `PROMPTSCOUT_QUERY_POLICY` enables allowlist mode.
- `PROMPTSCOUT_PATH_POLICY`: optional path privacy policy. Supported values are
  `keep` and `redact`. Defaults to `keep`.
- `PROMPTSCOUT_PATH_REPLACEMENT`: optional replacement path when paths are
  redacted. Defaults to `/_promptscout/redacted`.
- `PROMPTSCOUT_DEBUG`: optional debug logging flag. Use `true`, `1`, `yes`, or
  `on` to log ingest failures.

Do not hardcode ingest tokens in source control. The collector does not require
a brand ID, team-site ID, or Supabase credential. PromptScout groups traffic by
the brand-owned site source attached to the site-scoped ingest token.

## Minimal Edge Function

```ts
import { handlePromptScoutNetlifyEdgeRequest } from "promptscout-live-ai-traffic-netlify-edge";

export default async function promptScoutLiveAiTraffic(request, context) {
  return handlePromptScoutNetlifyEdgeRequest(request, context);
}
```

Declare the edge function in `netlify.toml`:

```toml
[[edge_functions]]
  path = "/*"
  excludedPath = "/assets/*"
  function = "promptscout-live-ai-traffic"
```

You can also use an inline edge function config when that fits the project:

```ts
export const config = {
  path: "/*",
};
```

## Delivery Behavior

The default handler starts PromptScout observation delivery, schedules it with
`context.waitUntil()` when available, and returns the response from
`context.next()`. In local tests or runtimes without `waitUntil`, delivery falls
back to a background promise so origin traffic still flows.

The collector sends canonical request observation events with
`sourceProvider: "netlify"` and `integration.name: "netlify-edge"`. Raw IP
addresses are not collected by default; the event records
`ipHash.algorithm: "none"` with `originalIpRetention: "not_collected"`.
