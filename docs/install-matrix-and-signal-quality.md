# Install Matrix and Signal Quality Guide

PromptScout Live AI Traffic shows request-level AI traffic that reached your
site. Pick the install path closest to where your production HTTP requests are
served, because server-side and edge-side visibility is more reliable than a
client-side analytics pixel.

## Quick Choice

Current customer install paths:

1. Vercel middleware for Next.js sites hosted on Vercel.
2. Cloudflare Worker for sites already proxied through Cloudflare.

Future placeholder paths:

1. Netlify Edge for sites served through Netlify edge functions.
2. WordPress plugin for WordPress sites where plugin deployment is the safest
   operational path.
3. Node/Express middleware for custom Node servers that own the request path.
4. nginx log forwarder for infrastructure teams that already collect edge or
   origin access logs.
5. CloudFront/AWS for AWS-hosted sites where CloudFront, Lambda@Edge, or
   regional Lambda owns request observation.
6. Fastly for sites already served through Fastly Compute or edge logging.

The future placeholder paths have package, example, and integration-doc shells,
but their runtime implementation and customer install instructions are
intentionally deferred. Do not treat them as current customer choices until
their placeholder docs are replaced with runtime setup guidance.

If two options fit, choose the one nearest the public request edge and easiest
to deploy without changing your origin application. For current installs, that
means Vercel middleware or Cloudflare Worker before any future placeholder
adapter.

## Install Matrix

| Install path | Status | Best fit | Reliability | Complexity | Why choose it |
| --- | --- | --- | --- | --- | --- |
| Vercel middleware | Current | Next.js sites on Vercel | High for routed page requests before the app route runs | Low | Add one middleware or proxy helper and use Vercel environment variables. |
| Cloudflare Worker | Current | Sites already proxied through Cloudflare | High at the edge for matched routes | Medium | Observe traffic before the origin while preserving normal Cloudflare routing. |
| Netlify Edge | Future placeholder | Netlify-hosted sites using edge functions | High for matched edge routes | Low to medium | Future adapter path; current docs are placeholder shells only. |
| nginx logs | Future placeholder | Sites behind nginx, reverse proxies, or log pipelines | High when logs include user agent, referer, host, path, method, and timestamp | Medium to high | Future log-forwarder path; current docs are placeholder shells only. |
| WordPress plugin | Future placeholder | WordPress sites managed by site owners or agencies | Medium to high for WordPress-rendered requests | Low | Future plugin path; current docs are placeholder shells only. |
| Node/Express | Future placeholder | Custom Node servers that own routing | High for requests reaching the Node app | Medium | Future middleware path; current docs are placeholder shells only. |
| CloudFront/AWS | Future placeholder | AWS sites using CloudFront, Lambda@Edge, regional Lambda, or centralized logs | High at the CDN or AWS request layer | Medium to high | Future AWS path; current docs are placeholder shells only. |
| Fastly | Future placeholder | Sites already served through Fastly | High at the edge for configured services | Medium to high | Future edge path; current docs are placeholder shells only. |

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
