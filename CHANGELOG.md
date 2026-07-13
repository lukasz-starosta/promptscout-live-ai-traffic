# Changelog

All notable changes to `@promptscout/live-ai-traffic` will be documented here.

This project publishes one public npm package. Internal provider workspaces and
examples use the same version for traceability, but remain private and are not
published.

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
