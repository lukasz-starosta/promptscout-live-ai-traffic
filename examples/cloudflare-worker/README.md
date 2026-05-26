# Cloudflare Worker Example

This example installs the customer-owned PromptScout Cloudflare Worker
collector. Cloudflare is the front door for the matched hostname, while the
customer's origin remains Vercel, Webflow, WordPress, Shopify, a custom server,
or any other origin already behind Cloudflare.

The Worker observes the request, sends a PromptScout live AI traffic event in
the background, and forwards the original request to the existing origin.
PromptScout does not host the site, terminate the origin connection, or fix
Cloudflare DNS/origin failures.

## Files

- `src/index.ts` exports the packaged Worker handler.
- `wrangler.toml` declares the Worker entry point, non-secret vars, and an
  example route binding.
- `package.json` exposes local Wrangler commands through Yarn.

## Configure

Install dependencies from the repository root first:

```bash
yarn install --immutable
```

Create the Cloudflare secret for the site-scoped PromptScout ingest token:

```bash
yarn dlx wrangler@latest secret put PROMPTSCOUT_INGEST_TOKEN
```

Edit `wrangler.toml` before deploy:

```toml
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]

[vars]
PROMPTSCOUT_INGEST_URL = "https://api.promptscout.com/live-ai-traffic/ingest"
PROMPTSCOUT_QUERY_POLICY = "omit"
PROMPTSCOUT_PATH_POLICY = "keep"
```

Keep `PROMPTSCOUT_INGEST_TOKEN` out of `wrangler.toml`; it belongs in
Cloudflare secrets.

## Run Locally

Run Wrangler's local development server:

```bash
yarn workspace @promptscout/live-ai-traffic-example-cloudflare-worker dev
```

Use Wrangler's local URL to simulate an AI crawler request:

```bash
curl -i \
  -H "User-Agent: OAI-SearchBot/1.0" \
  -H "Referer: https://chatgpt.com/share/example" \
  "http://127.0.0.1:8787/docs?utm_source=chatgpt"
```

For a fully mocked ingest smoke path, temporarily point
`PROMPTSCOUT_INGEST_URL` at a local HTTP sink. For Wrangler local development,
create a non-committed `examples/cloudflare-worker/.dev.vars` file:

```dotenv
PROMPTSCOUT_INGEST_TOKEN=local-smoke-token
PROMPTSCOUT_INGEST_URL=http://127.0.0.1:9000/live-ai-traffic/ingest
```

Confirm the sink receives a `request_observation` event while the curl response
still comes from the forwarded origin path.

## Deploy

Deploy with Wrangler after the route and secret are configured:

```bash
yarn workspace @promptscout/live-ai-traffic-example-cloudflare-worker deploy
```

Equivalent raw Wrangler command:

```bash
yarn dlx wrangler@latest deploy
```

Smoke the deployed route with:

```bash
curl -i \
  -H "User-Agent: PerplexityBot/1.0" \
  -H "Referer: https://perplexity.ai/search/example" \
  "https://example.com/docs?promptscout_smoke=1"
```

The response should match the customer's existing origin. A successful
PromptScout ingest confirms the Worker observed the traffic; it does not prove
that Cloudflare DNS, SSL, cache, firewall, or origin routing is healthy.

## Cloudflare Setup Notes

- DNS must be proxied through Cloudflare for the Worker route to run. Gray-cloud
  DNS records bypass the Worker.
- Route binding should be as narrow as possible at first, for example a test
  hostname or a specific path prefix before widening to `example.com/*`.
- SSL mode must already be correct for the customer's origin. The Worker does
  not repair Full, Full strict, certificate, redirect loop, or origin timeout
  problems.
- PromptScout is not responsible for DNS/origin failures. Customers retain
  ownership of Cloudflare zone settings, origin hosting, certificates, firewall
  rules, redirects, and uptime.

## Future Install Target

This manual setup is the baseline for a future one-click/OAuth Cloudflare
install flow. That installer should collect the zone, create or update this
Worker route, write the non-secret vars, store the ingest token as a Cloudflare
secret, and leave the origin ownership model unchanged.
