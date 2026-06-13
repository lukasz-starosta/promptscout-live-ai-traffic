# Dogfood Vercel Middleware Against PromptScout Ingest

Use this smoke when validating the Vercel middleware package against the real
PromptScout live AI traffic ingest PoC. It sends three controlled Next.js
Proxy-shaped requests through `trackPromptScoutAiTraffic` and expects the
PromptScout ingest token to bind them to the token-owned site source.

## Setup

Build the Vercel middleware package before running the smoke:

```bash
yarn dogfood:vercel
```

Required environment variables:

```bash
PROMPTSCOUT_INGEST_URL=https://app.promptscout.com/api/live-ai-traffic/ingest
PROMPTSCOUT_INGEST_TOKEN=...
```

Optional environment variables:

```bash
PROMPTSCOUT_DOGFOOD_HOST=preview-or-local-site.example.com
PROMPTSCOUT_DOGFOOD_DEBUG_URL=https://app.promptscout.com/api/live-ai-traffic/debug
PROMPTSCOUT_DOGFOOD_DEBUG_BEARER_TOKEN=...
PROMPTSCOUT_DOGFOOD_EXPECT_SOURCE_ID=...
PROMPTSCOUT_DOGFOOD_EXPECT_SOURCE_HOST=preview-or-local-site.example.com
```

Do not commit real ingest tokens or debug bearer tokens. The token should be
site-scoped to the `live_ai_traffic_sources` row you expect to verify.

## What The Smoke Sends

The script sends representative Vercel middleware events for:

| User agent | Expected provider classification |
| --- | --- |
| `ChatGPT-User/1.0` | `openai_chatgpt_user` |
| `OAI-SearchBot/1.0` | `openai_search_bot` |
| `GPTBot/1.3` | `openai_gptbot` |

Every event is generated through the Vercel middleware helper with
`sourceProvider` set to `vercel`. Query strings and IP metadata are omitted for
the dogfood run.

## Verification Evidence

After a successful run, record the JSON output on the Linear issue. The output
summarizes the posted user agents, HTTP ingest status, provider classification,
host, and path.

If `PROMPTSCOUT_DOGFOOD_DEBUG_URL` is set, the script also reads the
PromptScout debug/read surface and checks that it contains:

- `sourceProvider` / `vercel`
- the expected provider classifications
- a `source_id` or `sourceId`
- site source host metadata from `live_ai_traffic_sources`

If the debug surface is UI-only, run the smoke without
`PROMPTSCOUT_DOGFOOD_DEBUG_URL`, then confirm in PromptScout that the events are
grouped under the ingest token's site source and that the source metadata comes
from `live_ai_traffic_sources`.

## Local Or Preview Options

For a local PromptScout route, point `PROMPTSCOUT_INGEST_URL` at the local API
and use a local ingest token tied to a local `live_ai_traffic_sources` row. Set
`PROMPTSCOUT_DOGFOOD_HOST` to the source host and verify at least one accepted
event has the required `source_id` in `live_ai_traffic_events`.

For a preview deployment, set the same env vars in the Vercel project and run
controlled curl requests against a matched page route:

```bash
curl -A "ChatGPT-User/1.0" https://preview.example.com/
curl -A "OAI-SearchBot/1.0" https://preview.example.com/
curl -A "GPTBot/1.3" https://preview.example.com/
```

## Vercel Limitations

Vercel Hobby and Vercel Pro both run Next.js Proxy/Middleware, so the collector
does not require Pro just to execute. Pro is still better for team-owned
preview environments, higher traffic, and observability while dogfooding.

Next.js 16 uses `proxy.ts`; older apps use `middleware.ts`. Keep the same
collector body, but export the runtime function name that matches the Next.js
version.

The matcher decides which requests can produce events. The recommended matcher
excludes API routes, Next.js internals, metadata files, and common static
assets. If you need AI bot hits to `robots.txt`, `sitemap.xml`, images, CSS, or
JavaScript, adjust the matcher deliberately and watch ingest volume.
