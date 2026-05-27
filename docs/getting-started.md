# Getting Started

This repository uses Yarn workspaces with packages under `packages/*` and runnable shells under `examples/*`.

The current scaffold is intentionally minimal:

- `packages/core` owns shared placeholder types, helper exports, and the
  canonical live AI traffic event contract.
- Provider packages import `@promptscout/live-ai-traffic-core` through workspace dependencies.
- `packages/node-middleware` provides generic Node helpers and Express-style
  middleware that classify requests, normalize privacy-sensitive fields, and
  send matching events asynchronously.
- `packages/cloudflare-worker` is the Cloudflare Worker collector for sites
  already proxied through customer-owned Cloudflare routes.
- `packages/cloudfront-aws` parses CloudFront real-time access logs delivered
  through Kinesis Data Streams and can forward normalized events from a regional
  Lambda or Kinesis consumer.
- `packages/netlify-edge` provides the Netlify Edge Function collector for
  Netlify-hosted routes.
- Examples are workspace packages that import their matching provider or
  adapter package. The Express example can run with mocked ingest for local
  smoke checks.
- Runtime behavior, provider credentials, and deployment instructions for the
  remaining placeholder providers are intentionally deferred to later
  implementation issues.

Run the repo-owned verifier before handing off changes:

```bash
./scripts/verify
```

See [event-contract.md](event-contract.md) for the shared request observation
schema used by collectors and ingest endpoints.

See [install-matrix-and-signal-quality.md](install-matrix-and-signal-quality.md)
for customer-facing guidance on choosing the right integration, why server-side
request visibility matters, and how to distinguish crawler visits, user fetches,
AI referrals, and answer mentions.

See [privacy-security-operations.md](privacy-security-operations.md) for the
default privacy posture, site-scoped ingest token handling, failure modes, and
security FAQ.

See [release.md](release.md) for package versioning, release verification, npm
publishing, WordPress artifact, and Docker image guidance.
