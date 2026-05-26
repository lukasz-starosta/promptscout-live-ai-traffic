# PromptScout Live AI Traffic

Repository for the PromptScout live AI traffic packages and examples.

## Workspace Layout

This repository uses Yarn workspaces:

- `packages/core` contains shared event contracts, classification helpers,
  privacy normalization helpers, and the PromptScout ingest client.
- `packages/*` contains one provider package per integration.
- `packages/cloudflare-worker` contains the Cloudflare Worker runtime collector
  for customer-owned Cloudflare routes.
- `packages/cloudfront-aws` contains the AWS CloudFront real-time log parser and
  regional Kinesis/Lambda consumer helpers.
- `examples/*` contains one minimal workspace example per provider.
- `examples/cloudflare-worker` contains the runnable Wrangler example for the
  customer-owned Cloudflare Worker collector.
- `examples/cloudfront-aws` contains the AWS CloudFront real-time logs through
  Kinesis example notes.
- `docs/getting-started.md` and `docs/integrations/*` hold the initial docs shell.
- `docs/install-matrix-and-signal-quality.md` explains how customers should
  choose an install path and how to interpret collector signal quality.

Provider and example packages are private while this repo is pre-release. Some
provider directories remain placeholders until their runtime implementation work
lands in later issues. CloudFront/AWS is implemented through real-time access
logs delivered to Kinesis Data Streams, not CloudFront Functions.

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
