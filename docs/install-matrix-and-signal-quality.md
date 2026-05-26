# Install Matrix and Signal Quality Guide

PromptScout Live AI Traffic shows request-level AI traffic that reached your
site. Pick the install path closest to where your production HTTP requests are
served, because server-side and edge-side visibility is more reliable than a
client-side analytics pixel.

## Quick Choice

Use the first option in this list that matches your stack:

1. Vercel middleware for Next.js sites hosted on Vercel.
2. Cloudflare Worker for sites already proxied through Cloudflare.
3. Netlify Edge for sites served through Netlify edge functions.
4. WordPress plugin for WordPress sites where plugin deployment is the safest
   operational path.
5. Node/Express middleware for custom Node servers that own the request path.
6. nginx log forwarder for infrastructure teams that already collect edge or
   origin access logs.
7. CloudFront/AWS for AWS-hosted sites where CloudFront, Lambda@Edge, or
   regional Lambda owns request observation.
8. Fastly for sites already served through Fastly Compute or edge logging.

If two options fit, choose the one nearest the public request edge and easiest
to deploy without changing your origin application. For most hosted web apps,
that means Vercel, Cloudflare, Netlify, CloudFront/AWS, or Fastly before an
origin-only application middleware.

## Install Matrix

| Install path | Best fit | Reliability | Complexity | Why choose it |
| --- | --- | --- | --- | --- |
| Vercel middleware | Next.js sites on Vercel | High for routed page requests before the app route runs | Low | Add one middleware or proxy helper and use Vercel environment variables. |
| Cloudflare Worker | Sites already proxied through Cloudflare | High at the edge for matched routes | Medium | Observe traffic before the origin while preserving normal Cloudflare routing. |
| Netlify Edge | Netlify-hosted sites using edge functions | High for matched edge routes | Low to medium | Keep collection in Netlify's edge layer without adding origin server code. |
| nginx logs | Sites behind nginx, reverse proxies, or log pipelines | High when logs include user agent, referer, host, path, method, and timestamp | Medium to high | Use existing server logs when application changes are risky or impossible. |
| WordPress plugin | WordPress sites managed by site owners or agencies | Medium to high for WordPress-rendered requests | Low | Install through the WordPress admin or deployment process with server-side token storage. |
| Node/Express | Custom Node servers that own routing | High for requests reaching the Node app | Medium | Add middleware where your server already sees request headers. |
| CloudFront/AWS | AWS sites using CloudFront, Lambda@Edge, regional Lambda, or centralized logs | High at the CDN or AWS request layer | Medium to high | Fit into AWS-owned request handling and secret management. |
| Fastly | Sites already served through Fastly | High at the edge for configured services | Medium to high | Observe requests in Fastly Compute or edge logging before the origin. |

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
