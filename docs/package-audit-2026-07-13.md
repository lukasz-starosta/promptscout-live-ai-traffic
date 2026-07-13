# Package Audit: 2026-07-13

This audit reviewed every workspace under `packages/*` for request-path cost,
failure isolation, delivery correctness, privacy, and alignment with current
platform documentation.

## Implemented Runtime Packages

| Package | Result |
| --- | --- |
| `core` | Added a two-second timeout covering each complete attempt, kept bounded retries, stopped buffering successful response bodies, and refreshed the current OpenAI and Perplexity crawler documentation URLs. |
| `vercel-middleware` | Kept the documented `NextFetchEvent.waitUntil()` path, unknown-traffic skip, and recommended matcher; removed duplicate classification for tracked requests. |
| `cloudflare-worker` | Starts the origin fetch before analytics work, uses `ctx.waitUntil()`, and skips unknown traffic before ingest by default. |
| `netlify-edge` | Starts `context.next()` before analytics work, uses `context.waitUntil()`, and skips unknown traffic before ingest by default. |
| `fastly-compute` | Starts the origin fetch first and skips unknown traffic. Native Fastly delivery is now documented as best effort because the official JavaScript `FetchEvent` guide does not expose `waitUntil()`. |
| `cloudfront-aws` | Skips unknown records and empty ingest calls. Exhausted delivery now throws so Lambda/Kinesis retries instead of acknowledging an undelivered batch. |
| `node-middleware` | Already calls Express `next()` immediately, performs delivery in a caught background promise, skips unknown traffic, and uses shared privacy and ingest behavior. No package-specific change was needed. |
| `nginx-log-forwarder` | Already stays outside the request path, filters unknown traffic, batches delivery, and advances byte checkpoints only after accepted batches. No package-specific change was needed. |
| `wordpress-plugin` | Keeps unknown traffic out, defers outbound delivery to WordPress `shutdown`, and uses `wp_safe_remote_post()` for the admin-configured endpoint. |

## Placeholder Packages

`cloudflare`, `netlify`, `fastly`, `vercel`, `node-express`, and `wordpress`
remain four-line placeholder exports. They execute no request-path logic and
remain private, so there was no runtime optimization to apply. Their matching
implemented packages above remain the supported code paths.

## Official Documentation Checked

- Next.js Proxy and `NextFetchEvent.waitUntil()`:
  https://nextjs.org/docs/pages/api-reference/file-conventions/proxy
- Cloudflare Workers context lifecycle:
  https://developers.cloudflare.com/workers/runtime-apis/context/
- Netlify Edge Functions API:
  https://docs.netlify.com/build/edge-functions/api/
- Fastly JavaScript Compute lifecycle and performance guidance:
  https://www.fastly.com/documentation/guides/compute/developer-guides/javascript/
- AWS Lambda Kinesis failure reporting:
  https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html
- WordPress safe HTTP POST API and shutdown lifecycle:
  https://developer.wordpress.org/reference/functions/wp_safe_remote_post/
  and https://developer.wordpress.org/reference/hooks/shutdown/
- Current crawler evidence:
  https://developers.openai.com/api/docs/bots,
  https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler,
  https://docs.perplexity.ai/docs/resources/perplexity-crawlers, and
  https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers

## Remaining Architectural Limits

- User-agent classification identifies a documented token, not an authenticated
  sender. Verified-bot claims require provider IP or network verification.
- Best-effort request-path adapters can drop analytics when their runtime has no
  lifecycle extension. Durable delivery belongs in queues or logging pipelines.
- The public npm package currently exports only core and Vercel middleware;
  other implemented collectors remain private repository workspaces.
