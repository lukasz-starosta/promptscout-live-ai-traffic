# Vercel Example

The Vercel runtime implementation lives in
`@promptscout/live-ai-traffic/vercel-middleware`.

Install the public package from npm:

```bash
npm install @promptscout/live-ai-traffic@0.2.0
```

See `docs/integrations/vercel.md` for the full Vercel integration guide.

Use `proxy.ts` in Next.js 16:

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
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
