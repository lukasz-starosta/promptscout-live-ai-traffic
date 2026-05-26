# Getting Started

This repository uses Yarn workspaces with packages under `packages/*` and runnable shells under `examples/*`.

The current scaffold is intentionally minimal:

- `packages/core` owns shared placeholder types, helper exports, and the
  canonical live AI traffic event contract.
- Provider packages import `@promptscout/live-ai-traffic-core` through workspace dependencies.
- Examples are workspace packages that import their matching provider package.
- Runtime behavior, provider credentials, and deployment instructions are intentionally deferred to later implementation issues.

Run the repo-owned verifier before handing off changes:

```bash
./scripts/verify
```

See [event-contract.md](event-contract.md) for the shared request observation
schema used by collectors and ingest endpoints.
