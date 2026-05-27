# Vercel Example

The Vercel runtime implementation lives in
`@lukasz-starosta/promptscout-live-ai-traffic-vercel-middleware`.

This repository publishes private GitHub Packages only through the manual
release workflow. Use the local tarball install flow in
`docs/integrations/vercel.md` or the current `examples/vercel-nextjs` README
when testing the middleware before a private version is available.

Use `proxy.ts` in Next.js 16:

```ts
import { trackPromptScoutAiTraffic } from "@lukasz-starosta/promptscout-live-ai-traffic-vercel-middleware";
import { NextResponse, type NextProxy } from "next/server";

export const proxy: NextProxy = (request, event) => {
  trackPromptScoutAiTraffic(request, event, {
    endpoint: process.env.PROMPTSCOUT_LIVE_AI_TRAFFIC_ENDPOINT!,
    ingestToken: process.env.PROMPTSCOUT_LIVE_AI_TRAFFIC_TOKEN!,
  });

  return NextResponse.next();
};
```

See `docs/integrations/vercel.md` for matcher guidance and `middleware.ts`
compatibility notes.
