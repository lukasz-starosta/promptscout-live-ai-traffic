# Vercel / Next.js Proxy Integration

Use the Vercel middleware collector from a Next.js Proxy file so PromptScout can
observe AI crawler, fetcher, and referral traffic before your application route
runs.

## Install

For PromptScout dogfooding before npm packages are published, build local
tarballs from this repository and install both the core package and the
Vercel/Next.js middleware package into the local PromptScout checkout:

```bash
yarn pack:vercel-local
```

The command runs:

```bash
yarn tsc -b packages/core packages/vercel-middleware
```

It writes these local artifacts:

```text
.promptscout-local-packages/promptscout-live-ai-traffic-core-v0.0.0.tgz
.promptscout-local-packages/promptscout-live-ai-traffic-vercel-middleware-v0.0.0.tgz
```

From the PromptScout checkout, install the local tarballs with `file:`
dependencies:

```bash
LIVE_AI_TRAFFIC_REPO=/absolute/path/to/promptscout-live-ai-traffic
yarn add @promptscout/live-ai-traffic-core@file:$LIVE_AI_TRAFFIC_REPO/.promptscout-local-packages/promptscout-live-ai-traffic-core-v0.0.0.tgz @promptscout/live-ai-traffic-vercel-middleware@file:$LIVE_AI_TRAFFIC_REPO/.promptscout-local-packages/promptscout-live-ai-traffic-vercel-middleware-v0.0.0.tgz
```

Equivalent `package.json` entries:

```json
{
  "@promptscout/live-ai-traffic-core": "file:/absolute/path/to/promptscout-live-ai-traffic/.promptscout-local-packages/promptscout-live-ai-traffic-core-v0.0.0.tgz",
  "@promptscout/live-ai-traffic-vercel-middleware": "file:/absolute/path/to/promptscout-live-ai-traffic/.promptscout-local-packages/promptscout-live-ai-traffic-vercel-middleware-v0.0.0.tgz"
}
```

No npm publish is required.

Package version `0.0.0` is intentional for this local-first phase. Replace
these tarball installs with published semver only after PromptScout approves the
first public package release.

After the first public package release, new applications can install the same
middleware package name from npm:

```bash
yarn add @promptscout/live-ai-traffic-vercel-middleware
```

## Next.js 16 `proxy.ts`

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic-vercel-middleware";
import { NextResponse, type NextProxy } from "next/server";

export const proxy: NextProxy = (request, event) => {
  trackPromptScoutAiTraffic(request, event, {
    endpoint: process.env.PROMPTSCOUT_LIVE_AI_TRAFFIC_ENDPOINT!,
    ingestToken: process.env.PROMPTSCOUT_LIVE_AI_TRAFFIC_TOKEN!,
    privacy: {
      query: { mode: "omit" },
      ip: { mode: "disabled" },
    },
  });

  return NextResponse.next();
};

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|xml)$).*)",
  ],
};
```

No crawler or referrer detection rules are required in your app code. The
collector uses the shared PromptScout classifier and event schema.

The ingest token is site-scoped. Do not add a separate brand ID, team-site ID,
or team-wide token to the customer app. PromptScout groups accepted events by
the brand-owned site source attached to `PROMPTSCOUT_LIVE_AI_TRAFFIC_TOKEN`.

## Older `middleware.ts`

For Next.js versions that still use Middleware, keep the same function body in
`middleware.ts` and export `middleware` instead of `proxy`:

```ts
export function middleware(request: NextRequest, event: NextFetchEvent) {
  trackPromptScoutAiTraffic(request, event, options);
  return NextResponse.next();
}
```

## Delivery Behavior

When the Next.js/Vercel runtime provides `event.waitUntil`, delivery is scheduled
there so the normal page response path can continue without waiting for
PromptScout ingest. If `waitUntil` is unavailable, the helper starts a background
promise and returns it to the caller.

Unknown traffic is skipped by default. Set `includeUnknown: true` if you want to
collect non-classified requests as `other` for calibration.

## Matcher Tradeoffs

The example matcher avoids API routes, Next.js internals, image optimization,
and common static file extensions. That keeps noise and ingest volume low, but
it also means direct requests for assets such as `robots.txt`, `sitemap.xml`,
images, CSS, and JavaScript will not be collected.

If static assets matter to your AI-traffic analysis, remove the matching
exclusion deliberately and monitor ingest volume. Asset-heavy sites can generate
many observations from non-page requests.

## PromptScout Dogfood Smoke

When validating against the real PromptScout ingest PoC, use
`docs/dogfood-vercel-promptscout.md`. The dogfood smoke sends `ChatGPT-User`,
`OAI-SearchBot`, and `GPTBot` requests through the Vercel middleware helper and
records the ingest/debug evidence needed for the Linear issue.
