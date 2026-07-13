# Fastly Compute Integration

The Fastly Compute collector is implemented in
`promptscout-live-ai-traffic-fastly-compute` with an example in
`examples/fastly-compute`.

This collector import is a repo-local private workspace package. It is not
published as a separate npm package and is not exported from
`@promptscout/live-ai-traffic` yet. Treat this guide as a repository-local
example until a public collector subpath is added.

Fastly JavaScript Compute dispatches incoming requests through a fetch event.
The collector creates a PromptScout live AI traffic event from the original
request headers and URL, starts ingest delivery concurrently, and forwards the
unchanged request to the configured customer origin backend. Unknown traffic is
skipped by default; `includeUnknown: true` is available only as a diagnostic
override.

## Required backends

Configure two named backends on the Fastly Compute service:

- `origin`: the customer origin/backend that should receive the original
  request.
- `promptscout_ingest`: the PromptScout ingest backend used for outbound event
  delivery.

Fastly fetch calls use named backends, so both names must match the values
passed to `createFastlyComputeHandler`.

```ts
const handler = createFastlyComputeHandler({
  originBackend: "origin",
  ingestBackend: "promptscout_ingest",
  ingestEndpoint: "https://ingest.promptscout.com/live-ai-traffic",
  ingestToken: "...",
});
```

## Request Behavior And Delivery Limit

The handler forwards the original Compute `event.request` to the origin backend:

```ts
return fetch(event.request, { backend: "origin" });
```

The handler starts the origin fetch before classification and starts classified
PromptScout delivery concurrently. Fastly's documented JavaScript `FetchEvent`
API uses `respondWith()` but does not document a `waitUntil()` lifecycle hook.
The package accepts an optional `waitUntil` callback for compatible wrappers and
tests, but the checked-in Fastly example does not claim that native Fastly
provides one.

Without such a lifecycle hook, direct backend delivery is best effort: it can
run while the origin request is in flight, but Fastly may end the invocation
after the origin response resolves. Ingest errors never replace the customer
origin response. Deployments that require durable delivery should use a
customer-owned Fastly real-time logging pipeline or another out-of-request-path
collector instead of treating this direct example as lossless.

## Setup Probe

PromptScout can trigger a collector wiring probe at
`/__promptscout/setup-probe`. The Fastly Compute handler recognizes that path
when the request includes `x-promptscout-setup-probe: 1`,
`x-promptscout-probe-id`, and `x-promptscout-probe-token`, then sends a
separate `setup_probe` payload to `probeEndpoint` or, when omitted, the normal
`ingestEndpoint`.

Probe payloads include the probe id/token, `sourceProvider: "fastly"`, request
host/path/method, and the Fastly request id when available. They do not include
`providerClassification`, are not AI bot/referral events, and do not complete
the integration. Completion still requires the first real live AI traffic
`request_observation` event.

## Local and deploy notes

Initialize a JavaScript Compute application and copy in the example handler:

```bash
npm create @fastly/compute@latest
fastly compute serve
fastly compute deploy
```

Configure the customer origin and PromptScout ingest as Fastly service backends
before serving or deploying:

```bash
fastly service backend create --name origin --address www.example.com --port 443 --version latest
fastly service backend create --name promptscout_ingest --address ingest.promptscout.com --port 443 --version latest
```

Load the PromptScout ingest token from Fastly configuration or secret storage
in production. The ingest token resolves the PromptScout site source, so do not
configure a separate brand ID, team-site ID, or site ID in the Compute service.
The checked-in example keeps placeholders so that tokens are not committed.
