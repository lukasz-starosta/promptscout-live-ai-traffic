import { trackPromptScoutAiTraffic } from "@lukasz-starosta/promptscout-live-ai-traffic-vercel-middleware";
import { type NextProxy, NextResponse } from "next/server";

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
