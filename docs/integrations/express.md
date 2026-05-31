# Express Integration

`packages/node-middleware` exports generic Node helpers and Express-compatible
middleware for server-side AI traffic detection before route handlers run.

The import below uses `promptscout-live-ai-traffic-node-middleware`, a
repo-local private workspace package. It is not published as a separate npm
package and is not exported from `@promptscout/live-ai-traffic` yet. Treat this
guide as a repository-local example until a public collector subpath is added.

Use `createExpressLiveAiTrafficMiddleware(options)` before application routes:

```ts
import express from "express";
import { createExpressLiveAiTrafficMiddleware } from "promptscout-live-ai-traffic-node-middleware";

const app = express();

app.use(
  createExpressLiveAiTrafficMiddleware({
    endpoint: process.env.PROMPTSCOUT_INGEST_ENDPOINT,
    ingestToken: process.env.PROMPTSCOUT_INGEST_TOKEN,
  }),
);

app.get("/", (_req, res) => {
  res.json({ ok: true });
});
```

The middleware schedules detection and ingest in the background, calls `next()`
without awaiting delivery, and does not write to the response. Requests that do
not match a known AI or search signal are ignored by default.

The lower-level helper is `observeLiveAiTrafficNodeRequest(request, options)`.
Use it from custom Node HTTP servers when you want to decide how to schedule or
await delivery yourself.

## Setup Probe

PromptScout can trigger a collector wiring probe at
`/__promptscout/setup-probe`. The Node middleware recognizes that path when the
request includes `x-promptscout-setup-probe: 1`,
`x-promptscout-probe-id`, and `x-promptscout-probe-token`, then sends a
separate `setup_probe` payload through `probeClient`, `probeEndpoint`, or the
normal `endpoint`.

Probe payloads include the probe id/token, `sourceProvider: "node_express"`,
request host/path/method, and the request id when available. They do not include
`providerClassification`, are not AI bot/referral events, and do not complete
the integration. Completion still requires the first real live AI traffic
`request_observation` event.

The local example under `examples/express` uses a mocked ingest client by
default. Build it with `yarn tsc -b examples/express`, then run it:

```bash
PROMPTSCOUT_MOCK_INGEST=1 HOST=127.0.0.1 PORT=3000 node examples/express/dist/index.js
```

The example uses a real Express install when one is available. In this workspace
it falls back to a tiny local runner with the same middleware shape so mocked
ingest smoke checks do not require network installs.

Set `PROMPTSCOUT_MOCK_INGEST=0`, `PROMPTSCOUT_INGEST_ENDPOINT`, and
`PROMPTSCOUT_INGEST_TOKEN` to send events to a real ingest endpoint.
