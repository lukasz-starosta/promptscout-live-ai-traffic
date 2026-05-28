# Fastly Compute Example

This example shows the PromptScout collector shape for Fastly JavaScript
Compute. It classifies each incoming request at the edge, schedules PromptScout
ingest through a named Fastly backend, and forwards the original request to the
customer origin backend.

This example depends on `promptscout-live-ai-traffic-fastly-compute`, a
repo-local private workspace package. It is not published as a separate npm
package and is not exported from `@promptscout/live-ai-traffic` yet.

## Backend names

The example expects two Fastly backends:

- `origin`: the customer origin that should receive the original client request.
- `promptscout_ingest`: the PromptScout ingest host used only for collector
  event delivery.

Create or clone an editable service version, then configure both backends. With
the Fastly CLI, the commands are typically:

```bash
fastly service backend create --name origin --address www.example.com --port 443 --version latest
fastly service backend create --name promptscout_ingest --address ingest.promptscout.com --port 443 --version latest
```

Use the same backend names in `createFastlyComputeHandler`.

## Local serve

Start from a Fastly JavaScript Compute project:

```bash
npm create @fastly/compute@latest
```

Copy `src/index.ts` from this example into that project or depend on
`promptscout-live-ai-traffic-fastly-compute` from this workspace. Configure
local backend mappings for `origin` and `promptscout_ingest`, then run:

```bash
fastly compute serve
```

The local service should return the origin response even if the mocked or real
PromptScout ingest backend returns an error.

## Deploy

Before deploying, replace the placeholder token with a value loaded from Fastly
configuration or secret storage. The ingest token resolves the PromptScout site
source, so do not configure a separate brand ID, team-site ID, or site ID in the
Compute service. Do not hard-code production tokens.

```bash
fastly compute deploy
```

After deployment, verify that requests still reach `origin` unchanged and that
PromptScout receives events through the `promptscout_ingest` backend.
