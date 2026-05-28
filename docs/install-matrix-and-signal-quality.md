# Install Matrix and Signal Quality Guide

PromptScout Live AI Traffic shows request-level AI traffic that reached your
site. Pick the install path closest to where your production HTTP requests are
served, because server-side and edge-side visibility is more reliable than a
client-side analytics pixel.

## Quick Choice

Current local or customer install paths:

1. Vercel middleware for Next.js sites hosted on Vercel. Production apps should
   install `@promptscout/live-ai-traffic@0.1.0` and import the Vercel helper
   from `@promptscout/live-ai-traffic/vercel-middleware`; use a local checkout
   or generated tarballs only for repository development workflows.
2. Cloudflare Worker for sites already proxied through Cloudflare.
3. CloudFront/AWS real-time access logs for AWS sites where CloudFront can
   deliver request observations through Kinesis Data Streams.
4. Netlify Edge for sites served through Netlify edge functions.
5. nginx log forwarder for infrastructure teams that already collect edge or
   origin access logs.
6. WordPress plugin for WordPress sites where plugin deployment is the safest
   operational path.
7. Node/Express middleware for custom Node servers that own the request path.
8. Fastly Compute for sites already served through Fastly JavaScript Compute.

Deferred placeholder shells:

1. Generic package shells such as `packages/vercel`, `packages/cloudflare`,
   `packages/netlify`, `packages/node-express`, `packages/fastly`, and
   `packages/wordpress`.
2. Matching generic examples such as `examples/vercel`, `examples/cloudflare`,
   `examples/netlify`, `examples/node-express`, `examples/fastly`, and
   `examples/wordpress`.

The deferred placeholder shells exist for workspace shape and future routing,
but their runtime implementation and customer install instructions are
intentionally deferred. Do not treat a generic placeholder shell as a current
customer choice when a more specific implemented runtime package exists.

If two options fit, choose the one nearest the public request edge and easiest
to deploy without changing your origin application. For current installs, that
means Vercel middleware, Cloudflare Worker, CloudFront real-time logs, Netlify
Edge, nginx logs, the implemented WordPress plugin, Node middleware, or Fastly
Compute before any future placeholder adapter.

## Install Matrix

| Install path | Status | Best fit | Reliability | Complexity | Why choose it |
| --- | --- | --- | --- | --- | --- |
| Vercel middleware | Current | Next.js sites on Vercel | High for routed page requests before the app route runs | Low | Run `npm install @promptscout/live-ai-traffic@0.1.0`, import `@promptscout/live-ai-traffic/vercel-middleware`, add one middleware or proxy helper, and use Vercel environment variables. Local checkout or tarballs are for repository development workflows only. |
| Cloudflare Worker | Current | Sites already proxied through Cloudflare | High at the edge for matched routes | Medium | Observe traffic before the origin while preserving normal Cloudflare routing. |
| Netlify Edge | Current | Netlify-hosted sites using edge functions | High for matched edge routes | Low to medium | Add one edge function declaration and use Netlify environment variables. |
| WordPress plugin | Current | WordPress sites managed by site owners or agencies | Medium to high for WordPress-rendered requests | Low | Install the implemented plugin collector and configure its site-scoped ingest token in WordPress admin. |
| nginx logs | Current | Sites behind nginx, reverse proxies, or log pipelines | High when logs include user agent, referer, host, path, method, and timestamp | Medium to high | Run the log forwarder against access logs, batch classified AI traffic, and checkpoint processed bytes. |
| Node/Express | Current local adapter | Custom Node servers that own routing | High for requests reaching the Node app | Medium | Use `packages/node-middleware` and `examples/express` for local middleware smoke checks. |
| CloudFront/AWS | Current AWS path | AWS sites using CloudFront real-time access logs with Kinesis Data Streams and a regional Lambda or Kinesis consumer | High at the CDN log layer for configured cache behaviors, subject to best-effort log delivery | Medium to high | Avoids CloudFront Function outbound-network limits and does not require changing the origin application. |
| Fastly Compute | Current local adapter | Sites already served through Fastly JavaScript Compute | High at the edge for configured services | Medium to high | Use `packages/fastly-compute` and `examples/fastly-compute` for local Compute wiring before broader packaging. |

Reliability depends on route coverage. If the collector is attached only to
HTML pages, it will not observe excluded assets, API routes, or unproxied
hostnames. Complexity depends on who owns deployment, secrets, and rollback for
that layer.

## Why Client-Side Pixels Are Weak

Client-side pixels run only after a browser loads a page and executes
JavaScript. Many AI crawlers and server-side fetchers request HTML without
running page scripts, so a browser pixel can miss the exact traffic you are
trying to measure.

Server-side, edge-side, or log-based collectors see the HTTP request itself:
user agent, referer, host, path, method, timestamp, and integration metadata.
Those signals are enough to classify request observations without asking the
visitor's browser to cooperate after the page loads.

Client-side analytics can still help with conventional browser behavior, but it
should not be the primary source for AI crawler detection.

## Token Model

Each install uses one site-scoped PromptScout ingest token. The token is issued
for one brand-owned site source, and PromptScout groups accepted events under
the site source attached to that token.

Do not add a separate brand ID, team-site ID, or team-wide token to customer
install code. The ingest token is the routing credential. If you operate
multiple production sites, staging sites, or development sites, use a separate
site-scoped token for each site source so rotation and revocation stay isolated.

Store the token only in the server-side or edge-side secret store for your
provider. Never put it in browser-visible JavaScript, public plugin settings,
source control, screenshots, or logs.

## What The Signals Mean

PromptScout Live AI Traffic records request observations. It does not prove
that an AI assistant mentioned, cited, recommended, or summarized a brand.

| Signal | What it shows | What it does not prove |
| --- | --- | --- |
| AI crawler visit | A documented crawler or bot user agent requested a page, such as an AI search crawler or training crawler. | That the page appeared in a specific answer. |
| AI user fetch | A user-triggered AI fetcher requested a page, such as `ChatGPT-User`, `Claude-User`, or similar provider fetchers. | What the user asked, what the assistant answered, or whether the page was cited. |
| AI referral | A browser visit arrived with a referer from an AI assistant or AI search surface. | That the assistant crawled the page or mentioned the brand in an answer. |
| ChatGPT answer mention | PromptScout answer monitoring or another answer-level source observed the brand or page in a generated answer. | A collector event by itself cannot establish this; it is a separate evidence type. |

For reporting, treat crawler and user-fetch user agents as stronger
request-level evidence than referral-only signals. Treat referrals as advisory
context because browsers and intermediaries can omit, rewrite, or copy referers.

## Lowest-Risk Selection

For a technical installer, lowest risk usually means:

1. Install at the layer you already operate and can roll back quickly.
2. Keep PromptScout delivery asynchronous so customer traffic fails open.
3. Use the provider's secret store for the site-scoped token.
4. Start with page routes before expanding to assets or APIs.
5. Confirm that observed events are grouped under the expected brand-owned site
   source in PromptScout.

If an edge integration is available in your stack, prefer it over a browser
pixel. If edge deployment is blocked, use server middleware or logs rather than
adding client-only tracking.
