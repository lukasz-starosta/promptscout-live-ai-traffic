# Vercel / Next.js Proxy Integration

Use the Vercel middleware collector from a Next.js Proxy file so PromptScout can
observe AI crawler, fetcher, and referral traffic before your application route
runs.

## Install

Install the public package from npm:

```bash
npm install @promptscout/live-ai-traffic@0.1.0
```

For Yarn:

```bash
yarn add @promptscout/live-ai-traffic@0.1.0
```

Pin exact versions in production apps. The Vercel collector is imported from
the package subpath; it is not a separate npm package.

## Next.js 16 `proxy.ts`

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
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
