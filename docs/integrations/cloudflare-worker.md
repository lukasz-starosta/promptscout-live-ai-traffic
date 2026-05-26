# Cloudflare Worker Collector

`@promptscout/live-ai-traffic-cloudflare-worker` is a customer-owned edge
collector for sites already proxied through Cloudflare. It observes each
matching request, classifies the traffic with `packages/core`, sends a request
observation to PromptScout in the background with `ctx.waitUntil`, and forwards
the original request to the customer's origin with `fetch(request)`.

Cloudflare is one runtime adapter for live AI traffic collection. Customers can
also use other PromptScout adapters when Cloudflare is not in their serving
path.

## Worker Bindings

Configure these bindings in Wrangler or the Cloudflare dashboard:

- `PROMPTSCOUT_INGEST_TOKEN`: site-scoped ingest token. Store this as a secret.
- `PROMPTSCOUT_INGEST_URL`: PromptScout live AI traffic ingest endpoint.
- `PROMPTSCOUT_QUERY_POLICY`: optional query privacy policy. Supported values
  are `keep`, `omit`, and `allowlist`. Defaults to `keep`.
- `PROMPTSCOUT_QUERY_ALLOWLIST`: comma-separated query keys to keep when
  `PROMPTSCOUT_QUERY_POLICY=allowlist`.
- `PROMPTSCOUT_PATH_POLICY`: optional path privacy policy. Supported values are
  `keep` and `redact`. Defaults to `keep`.
- `PROMPTSCOUT_PATH_REPLACEMENT`: optional replacement path when paths are
  redacted. Defaults to `/_promptscout/redacted`.
- `PROMPTSCOUT_DEBUG`: optional debug logging flag. Use `true`, `1`, `yes`, or
  `on` to log ingest failures.

Do not hardcode ingest tokens in source control. The Worker does not require a
brand ID, team-site ID, or Supabase credential. PromptScout groups traffic by
the brand-owned site source attached to the site-scoped ingest token.

## Minimal Worker

```ts
import worker from "@promptscout/live-ai-traffic-cloudflare-worker";

export default worker;
```

Attach the Worker to Cloudflare routes for the proxied hostnames you want to
observe, for example `example.com/*`. The Worker forwards requests to the origin
and does not require PromptScout to proxy customer traffic.

## Delivery Behavior

The default handler calls `ctx.passThroughOnException()` when available, starts
the PromptScout observation delivery, schedules it with `ctx.waitUntil()`, and
returns the origin response from `fetch(request)`. In local tests or runtimes
without `waitUntil`, delivery falls back to a background promise so origin
traffic still flows.

The collector sends canonical request observation events with
`sourceProvider: "cloudflare"` and `integration.name: "cloudflare-worker"`.
Raw IP addresses are not collected by default; the event records
`ipHash.algorithm: "none"` with `originalIpRetention: "not_collected"`.
