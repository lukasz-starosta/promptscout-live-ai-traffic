# Getting Started

This repository uses Yarn workspaces with packages under `packages/*` and runnable shells under `examples/*`.

The current scaffold is intentionally minimal:

- `packages/core` owns shared placeholder types, helper exports, and the
  canonical live AI traffic event contract.
- Provider packages import `@promptscout/live-ai-traffic-core` through workspace dependencies.
- `packages/cloudflare-worker` is the Cloudflare Worker collector for sites
  already proxied through customer-owned Cloudflare routes.
- Examples are workspace packages that import their matching provider package.
- Most placeholder provider runtime behavior, provider credentials, and
  deployment instructions are intentionally deferred to later implementation
  issues.

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
