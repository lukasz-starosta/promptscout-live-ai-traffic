# PromptScout Live AI Traffic

Repository for the PromptScout live AI traffic packages and examples.

## Current Release Status

This repo is local-first during dogfooding. PromptScout is not publishing npm
packages from this repository yet, and package version `0.0.0` is intentional
until the first public package release is approved. Use workspace installs or
packed local tarballs when testing collectors in another app.

The first local install target is the Next.js/Vercel middleware in
`packages/vercel-middleware`, with the runnable reference app in
`examples/vercel-nextjs`.

## Local Next.js/Vercel Install

From this repository checkout, build and pack the shared core package and the
Vercel middleware package:

```bash
corepack enable
yarn install --immutable
yarn tsc -b packages/core packages/vercel-middleware
(cd packages/core && yarn pack --out /tmp/promptscout-live-ai-traffic-core-0.0.0.tgz)
(cd packages/vercel-middleware && yarn pack --out /tmp/promptscout-live-ai-traffic-vercel-middleware-0.0.0.tgz)
```

Then install both local tarballs in the Next.js app you are dogfooding:

```bash
npm install \
  /tmp/promptscout-live-ai-traffic-core-0.0.0.tgz \
  /tmp/promptscout-live-ai-traffic-vercel-middleware-0.0.0.tgz
```

Add the `proxy.ts` or `middleware.ts` shown in
[docs/integrations/vercel.md](docs/integrations/vercel.md). Configure only the
PromptScout ingest URL and site-scoped ingest token in server-side or Vercel
environment variables. The token resolves the PromptScout site source; do not
add a separate brand ID or team-site ID to the dogfood app.

## Workspace Layout

This repository uses Yarn workspaces:

- `packages/core` contains shared event contracts, classification helpers,
  privacy normalization helpers, and the PromptScout ingest client.
- `packages/*` contains provider package shells plus implemented runtime
  adapters such as `packages/vercel-middleware` and `packages/node-middleware`.
- `packages/vercel-middleware` contains the Next.js/Vercel Proxy and Middleware
  collector used by the local dogfood path.
- `packages/cloudflare-worker` contains the Cloudflare Worker runtime collector
  for customer-owned Cloudflare routes.
- `packages/cloudfront-aws` contains the AWS CloudFront real-time log parser and
  regional Kinesis/Lambda consumer helpers.
- `packages/netlify-edge` contains the Netlify Edge Function runtime collector
  for Netlify-hosted routes.
- `packages/fastly-compute` contains the Fastly JavaScript Compute collector.
- `examples/*` contains minimal workspace examples, including the Next.js
  middleware example under `examples/vercel-nextjs` and the Express middleware
  example under `examples/express`.
- `examples/cloudflare-worker` contains the runnable Wrangler example for the
  customer-owned Cloudflare Worker collector.
- `examples/cloudfront-aws` contains the AWS CloudFront real-time logs through
  Kinesis example notes.
- `examples/netlify-edge` contains the Netlify Edge Function example and
  declaration for Netlify-hosted routes.
- `docs/getting-started.md` and `docs/integrations/*` hold the initial docs shell.
- `docs/install-matrix-and-signal-quality.md` explains how customers should
  choose an install path and how to interpret collector signal quality.

Provider packages are configured for release dry-runs while this repo is
pre-release, but no npm package should be published yet. Some generic provider
directories remain placeholders until their runtime implementation work lands in
later issues. Future published provider packages will use the shared repository
version. Example workspaces keep the same version for traceability, but remain
private and are not published. See [docs/release.md](docs/release.md) for the
deferred release gate. `packages/node-middleware` and runtime collectors such as
`packages/vercel-middleware`, `packages/netlify-edge`, `packages/cloudfront-aws`,
and `packages/fastly-compute` reuse the shared core classifier, privacy
normalization helpers, and ingest client for implemented local paths.
CloudFront/AWS is implemented through real-time access logs delivered to Kinesis
Data Streams, not CloudFront Functions. `examples/fastly-compute` shows how to
wire Fastly JavaScript Compute to customer origin and PromptScout ingest
backends.

## Verification

Run the repo-owned verification command before pushing changes:

```bash
./scripts/verify
```

The command is intentionally lightweight while the repository is in its
foundation phase. It checks repository text formatting, scaffold completeness,
shell script syntax, and focused verifier tests. See
[docs/verification.md](docs/verification.md) for the full contract and current
non-goals.

The shared request observation schema is documented in
[docs/event-contract.md](docs/event-contract.md). These events are analytics
observations, not proof that an AI answer mentioned a brand or page.

Classifier source evidence and fixture confidence labels are documented in
[docs/evidence.md](docs/evidence.md).

Customer-facing install selection, site-scoped ingest token behavior, and
signal-quality guidance are documented in
[docs/install-matrix-and-signal-quality.md](docs/install-matrix-and-signal-quality.md).

Collector privacy, token rotation, failure handling, and operational ownership
guidance is documented in
[docs/privacy-security-operations.md](docs/privacy-security-operations.md).
