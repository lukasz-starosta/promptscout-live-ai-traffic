# PromptScout Live AI Traffic for Vercel Next.js

This example shows the files a Vercel-hosted Next.js app needs to report live
AI traffic to PromptScout. This detects request-level visits, not ChatGPT answer mentions.
It covers AI crawlers, AI search bots, and AI browser fetchers, but not whether
your brand appeared in an AI answer.

Traffic is grouped in PromptScout by the site source attached to the ingest token.
You do not need to configure a separate brand ID or team-site ID in the app.

## Install

Install the public package:

```bash
npm install @promptscout/live-ai-traffic@0.2.1
```

For Yarn:

```bash
yarn add @promptscout/live-ai-traffic@0.2.1
```

The middleware helper is exposed through
`@promptscout/live-ai-traffic/vercel-middleware`.

Copy `.env.example` to `.env.local` and set the token and ingest URL from
PromptScout:

```bash
PROMPTSCOUT_INGEST_TOKEN=
PROMPTSCOUT_INGEST_URL=https://app.promptscout.com/api/live-ai-traffic/ingest
```

Paste your site-scoped ingest token after `PROMPTSCOUT_INGEST_TOKEN=` in your
local `.env.local` file. Do not commit real ingest tokens.

## Next.js 16 `proxy.ts`

Copy `proxy.ts` to the root of your Next.js app, next to `app` or `pages`. If
your app uses a `src` directory, place it at `src/proxy.ts`.

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
import { NextResponse, type NextProxy } from "next/server";

export const proxy: NextProxy = (request, event) => {
  trackPromptScoutAiTraffic(request, event, {
    endpoint: process.env.PROMPTSCOUT_INGEST_URL ?? "",
    ingestToken: process.env.PROMPTSCOUT_INGEST_TOKEN ?? "",
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

The matcher keeps API routes, Next.js internals, metadata files, and common
static assets out of the request stream so page traffic stays easier to review.

## Older `middleware.ts`

For older `middleware.ts` setups, keep the same body in `middleware.ts` and
export `middleware`:

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

export function middleware(request: NextRequest, event: NextFetchEvent) {
  trackPromptScoutAiTraffic(request, event, {
    endpoint: process.env.PROMPTSCOUT_INGEST_URL ?? "",
    ingestToken: process.env.PROMPTSCOUT_INGEST_TOKEN ?? "",
    privacy: {
      query: { mode: "omit" },
      ip: { mode: "disabled" },
    },
  });

  return NextResponse.next();
}
```

Keep the same `config.matcher` export if you want the same route coverage.

## Local dev

Run your app as usual:

```bash
npm run dev
```

Then request a page with a known AI user agent:

```bash
curl -A "ChatGPT-User/1.0" http://localhost:3000/
```

Local PromptScout delivery depends on the ingest URL and token in `.env.local`.
The helper uses `event.waitUntil` on Vercel/Next.js so the page response does
not wait for ingest.

## Local curl simulation

This repository includes a mocked smoke script that uses
`fixtures/chatgpt-user-request.json` and proves the collector builds and posts
one event without contacting PromptScout:

```bash
yarn tsc -b packages/vercel-middleware
node examples/vercel-nextjs/smoke-test.mjs
```

Expected output:

```json
{"ok":true,"status":202,"postedEvents":1,"provider":"openai_chatgpt_user"}
```

You can also replay the same fixture against a local Next.js dev server:

```bash
curl -A "ChatGPT-User/1.0" -H "Referer: https://chatgpt.com/share/example" http://localhost:3000/docs
```

## Vercel deploy

Set `PROMPTSCOUT_INGEST_TOKEN` and `PROMPTSCOUT_INGEST_URL` in the Vercel
project environment variables for Production and Preview as needed. After
deploy, AI crawler and AI browser requests that match the proxy matcher are
sent to PromptScout and grouped under the site source resolved from the ingest
token.
