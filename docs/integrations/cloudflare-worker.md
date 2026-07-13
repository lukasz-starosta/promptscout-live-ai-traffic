# Cloudflare Worker Collector

`promptscout-live-ai-traffic-cloudflare-worker` is a customer-owned edge
collector for sites already proxied through Cloudflare. It observes each
matching request, classifies the traffic with `packages/core`, sends a request
observation to PromptScout in the background with `ctx.waitUntil`, and forwards
the original request to the customer's origin with `fetch(request)`.

Cloudflare is one runtime adapter for live AI traffic collection. Customers can
also use other PromptScout adapters when Cloudflare is not in their serving
path.

Cloudflare is the front door for the matched hostname. The customer's origin
remains Vercel, Webflow, WordPress, Shopify, a custom server, or whichever
hosting platform already receives requests from Cloudflare. PromptScout is not
responsible for DNS/origin failures, certificate problems, Cloudflare firewall
rules, redirect loops, cache behavior, or origin uptime.

Use [`../../examples/cloudflare-worker`](../../examples/cloudflare-worker) for
the runnable Wrangler example.

## Package Status

The import below uses `promptscout-live-ai-traffic-cloudflare-worker`, a
repo-local private workspace package. It is not published as a separate npm
package and is not exported from `@promptscout/live-ai-traffic` yet. Treat this
guide as a repository-local example until a public collector subpath is added.

## Worker Bindings

Configure these bindings in Wrangler or the Cloudflare dashboard:

- `PROMPTSCOUT_INGEST_TOKEN`: site-scoped ingest token. Store this as a secret.
- `PROMPTSCOUT_INGEST_URL`: PromptScout live AI traffic ingest endpoint.
- `PROMPTSCOUT_QUERY_POLICY`: optional query privacy policy. Supported values
  are `keep`, `omit`, and `allowlist`. Defaults to `omit`.
- `PROMPTSCOUT_QUERY_ALLOWLIST`: comma-separated query keys to keep. Setting
  this without `PROMPTSCOUT_QUERY_POLICY` enables allowlist mode. Use
  `PROMPTSCOUT_QUERY_POLICY=keep` only when full query strings are safe to
  send.
- `PROMPTSCOUT_PATH_POLICY`: optional path privacy policy. Supported values are
  `keep` and `redact`. Defaults to `keep`.
- `PROMPTSCOUT_PATH_REPLACEMENT`: optional replacement path when paths are
  redacted. Defaults to `/_promptscout/redacted`.
- `PROMPTSCOUT_INCLUDE_UNKNOWN`: optional diagnostic override. Unknown traffic
  is skipped by default; set this only when intentionally measuring the full
  matched route volume.
- `PROMPTSCOUT_DEBUG`: optional debug logging flag. Use `true`, `1`, `yes`, or
  `on` to log ingest failures.

Do not hardcode ingest tokens in source control. The Worker does not require a
brand ID, team-site ID, or Supabase credential. PromptScout groups traffic by
the brand-owned site source attached to the site-scoped ingest token.

Keep `PROMPTSCOUT_INGEST_TOKEN` in Cloudflare secrets:

```bash
yarn dlx wrangler@latest --cwd examples/cloudflare-worker secret put PROMPTSCOUT_INGEST_TOKEN
```

Non-secret variables can live in `wrangler.toml`:

```toml
[vars]
PROMPTSCOUT_INGEST_URL = "https://api.promptscout.com/live-ai-traffic/ingest"
PROMPTSCOUT_QUERY_POLICY = "omit"
PROMPTSCOUT_PATH_POLICY = "keep"
PROMPTSCOUT_DEBUG = "false"
```

## Minimal Worker

```ts
import worker from "promptscout-live-ai-traffic-cloudflare-worker";

export default worker;
```

Attach the Worker to Cloudflare routes for the proxied hostnames you want to
observe, for example `example.com/*`. The Worker forwards requests to the origin
and does not require PromptScout to proxy customer traffic.

The route must match an orange-cloud proxied DNS record. Gray-cloud DNS records
send traffic directly to the origin and bypass the Worker.

```toml
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]
```

Start with a narrow route, such as a test hostname or path prefix, then widen it
after smoke testing. Confirm the Cloudflare SSL mode already works with the
origin before installing the Worker. The Worker does not repair Full, Full
strict, origin certificate, timeout, redirect, or firewall misconfiguration.

## Local Wrangler Run

From the repository root:

```bash
yarn install --immutable
yarn workspace promptscout-live-ai-traffic-example-cloudflare-worker dev
```

Then simulate an AI crawler request:

```bash
curl -i \
  -H "User-Agent: OAI-SearchBot/1.0" \
  -H "Referer: https://chatgpt.com/share/example" \
  "http://127.0.0.1:8787/docs?utm_source=chatgpt"
```

For mocked ingest locally, point `PROMPTSCOUT_INGEST_URL` at a local HTTP sink
and confirm the sink receives a `request_observation` event while curl still
gets the forwarded origin response.

## Setup Probe

PromptScout can trigger a collector wiring probe at
`/__promptscout/setup-probe`. The Worker recognizes that path when the request
includes `x-promptscout-setup-probe: 1`, `x-promptscout-probe-id`, and
`x-promptscout-probe-token`, then sends a separate `setup_probe` payload to
`PROMPTSCOUT_PROBE_URL` or, when omitted, the normal
`PROMPTSCOUT_INGEST_URL`.

Probe payloads include the probe id/token, `sourceProvider: "cloudflare"`,
request host/path/method, and `cf-ray` as the request id when available. They do
not include `providerClassification`, are not AI bot/referral events, and do not
complete the integration. Completion still requires the first real live AI
traffic `request_observation` event.

## Deploy

After setting the route and secret:

```bash
yarn workspace promptscout-live-ai-traffic-example-cloudflare-worker deploy
```

Equivalent raw Wrangler command:

```bash
yarn dlx wrangler@latest --cwd examples/cloudflare-worker deploy
```

Manual smoke path:

```bash
curl -i \
  -H "User-Agent: PerplexityBot/1.0" \
  -H "Referer: https://perplexity.ai/search/example" \
  "https://example.com/docs?promptscout_smoke=1"
```

The expected result is the same response the customer's origin would return,
plus a PromptScout live AI traffic observation. If the request fails before the
origin responds, debug Cloudflare DNS, route matching, SSL, firewall, cache, and
origin health first.

## Delivery Behavior

The default handler starts `fetch(request)` first, then classifies the request.
Unknown traffic is skipped without an ingest call. Classified observations are
scheduled with `ctx.waitUntil()` and the origin response remains independent of
PromptScout delivery. In local tests or runtimes without `waitUntil`, delivery
falls back to a best-effort background promise.

The collector sends canonical request observation events with
`sourceProvider: "cloudflare"` and `integration.name: "cloudflare-worker"`.
Raw IP addresses are not collected by default; the event records
`ipHash.algorithm: "none"` with `originalIpRetention: "not_collected"`.

## Future One-Click Install

This manual setup is the stable target for a future one-click/OAuth Cloudflare
installer. The installer should collect the zone and route, create or update the
Worker, write non-secret vars, store the ingest token as a Cloudflare secret,
and make the same ownership model explicit: Cloudflare remains the front door,
the customer's origin remains customer-owned, and PromptScout is not responsible
for DNS/origin failures.
