# PromptScout Cloudflare Worker

This template deploys the PromptScout Traffic collector to your Cloudflare
account. It forwards every request to your existing website and sends matching
AI traffic observations to PromptScout in the background.

## Deploy from the Cloudflare dashboard

Use the Deploy to Cloudflare flow. During setup, paste the install token and
ingest URL from PromptScout.

After deployment:

1. Open the Worker in Cloudflare.
2. Go to **Settings > Domains & Routes**.
3. Add a route for the proxied website hostname, such as `example.com/*`.
4. Confirm that the website still loads.
5. Return to PromptScout and run the setup check.

The route requires an orange-cloud proxied DNS record. Keep mail records and
other non-HTTP services set to DNS only.

## Deploy with Wrangler

Install dependencies, add the PromptScout values, and deploy:

```bash
npm install
npx wrangler secret put PROMPTSCOUT_INGEST_TOKEN
npx wrangler secret put PROMPTSCOUT_INGEST_URL
npx wrangler deploy
```

Add the website route in `wrangler.jsonc` or through the Cloudflare dashboard.
