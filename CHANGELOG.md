# Changelog

All notable changes to `@promptscout/live-ai-traffic` will be documented here.

This project publishes one public npm package. Internal provider workspaces and
examples use the same version for traceability, but remain private and are not
published.

## Unreleased

### Fixed

- Return an explicit `502 Bad Gateway` response when the Cloudflare Worker
  cannot reach the customer origin, while keeping PromptScout delivery
  fail-open and scheduled through `waitUntil`.

## 0.2.1

### Added

- Export integration metadata and markdown together through the typed
  `@promptscout/live-ai-traffic/docs-content` JavaScript subpath. Consumers no
  longer need bundler-specific markdown loaders.

### Fixed

- Describe the Cloudflare Worker guide as the public
  `@promptscout/live-ai-traffic/cloudflare-worker` subpath in the docs manifest.

## 0.2.0

### Added

- Publish the Cloudflare Worker collector as the
  `@promptscout/live-ai-traffic/cloudflare-worker` subpath export. It was
  previously a repo-local private workspace package with no public install path.
- Export the shipped integration guides as `./docs/*` so consumers can render
  the published markdown instead of transcribing it.
- Declare `tokenEnvVar` per guide in `docs-manifest.json`. The Vercel collector
  reads `PROMPTSCOUT_LIVE_AI_TRAFFIC_TOKEN`; the Cloudflare, Netlify Edge,
  CloudFront, and Node/Express collectors read `PROMPTSCOUT_INGEST_TOKEN`.
  Guides that configure the token elsewhere omit the field.

### Changed

- Rewrite the Cloudflare Worker guide with zone setup, DNS and mail safety, SSL
  mode, hostname matching, and an install verification/troubleshooting section.
- Point `examples/cloudflare-worker` at the public subpath export so the example
  performs the same install a customer performs.

### Fixed

- Replace the incorrect `api.promptscout.com/live-ai-traffic/ingest` ingest URL
  in the Cloudflare Worker example and guide with a dashboard-sourced
  placeholder.

## 0.1.3

- Bounded each shared ingest attempt to two seconds by default and stopped
  buffering successful response bodies. The timeout also covers failure-body
  reads so a stalled diagnostic response cannot hold an attempt open.
- Skipped unclassified traffic by default in the Cloudflare, Netlify, Fastly,
  and CloudFront collectors, matching the existing Vercel, Node, nginx, and
  WordPress behavior.
- Started origin or downstream work before collector delivery in the
  Cloudflare, Netlify, and Fastly request-path adapters.
- Made CloudFront/AWS ingest exhaustion fail the Lambda invocation so Kinesis
  can retry instead of acknowledging dropped analytics.
- Deferred WordPress delivery to `shutdown` and switched customer-configured
  ingest URLs to `wp_safe_remote_post`.
- Refreshed OpenAI and Perplexity classifier evidence links and clarified Fastly's
  best-effort delivery limitation.

## 0.1.2

- Released setup-probe-capable collectors for the one-install PromptScout setup
  flow.
- Added Vercel middleware support for `__promptscout/setup-probe` requests with
  `setup_probe` callbacks.
- Documented that setup probes and live traffic use the same middleware install;
  `probeEndpoint` remains optional and falls back to the normal ingest endpoint.

## 0.1.1

- Preserved safe landing query attribution for query-classified AI referral
  visits as a closed `request.search` value such as `?utm_source=chatgpt.com`.
- Kept raw landing query strings, unsafe query keys, prompt text, tokens, email
  values, referer query strings, and fragments out of events before ingest.
- Documented the package payload contract for PromptScout to consume in the
  PS-311 follow-up.

## 0.1.0

- Switched to the single public npm package `@promptscout/live-ai-traffic`.
- Added public subpath exports for `.`, `./core`, and `./vercel-middleware`.
- Replaced the old private package release path with public npm publishing.
