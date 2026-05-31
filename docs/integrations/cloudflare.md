# Cloudflare Integration

`packages/cloudflare` remains the generic Cloudflare integration placeholder.
The customer-owned edge collector for proxied Cloudflare sites lives in
[`cloudflare-worker.md`](cloudflare-worker.md) and is implemented by
`packages/cloudflare-worker`.

Runtime implementation for the generic `packages/cloudflare` placeholder is
intentionally deferred.

## Setup Probe

Use the implemented Cloudflare Worker collector documented in
[`cloudflare-worker.md`](cloudflare-worker.md) for setup probe support. This
generic placeholder package does not expose a runtime collector or probe path
yet.
