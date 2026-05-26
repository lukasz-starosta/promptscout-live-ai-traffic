# Netlify Edge Example

This example installs the PromptScout Netlify Edge collector as a request-level
edge function. It observes matching requests, schedules PromptScout ingest with
`context.waitUntil()` when Netlify provides it, and returns `context.next()` so
the normal Netlify request chain continues.

## Environment Variables

Configure these in Netlify with a Functions runtime scope:

- `PROMPTSCOUT_INGEST_TOKEN`: site-scoped PromptScout ingest token. Store this
  as a secret.
- `PROMPTSCOUT_INGEST_URL`: PromptScout live AI traffic ingest endpoint.
- `PROMPTSCOUT_QUERY_POLICY`: optional query privacy policy. Supported values
  are `keep`, `omit`, and `allowlist`. Defaults to `omit`.
- `PROMPTSCOUT_QUERY_ALLOWLIST`: comma-separated query keys to keep. Setting
  this without `PROMPTSCOUT_QUERY_POLICY` enables allowlist mode.
- `PROMPTSCOUT_PATH_POLICY`: optional path privacy policy. Supported values are
  `keep` and `redact`. Defaults to `keep`.
- `PROMPTSCOUT_PATH_REPLACEMENT`: optional replacement path when paths are
  redacted. Defaults to `/_promptscout/redacted`.
- `PROMPTSCOUT_DEBUG`: optional debug logging flag. Use `true`, `1`, `yes`, or
  `on` to log ingest failures.

Do not hardcode ingest tokens in source control. The collector does not require
a brand ID, team-site ID, or Supabase credential. PromptScout groups traffic by
the brand-owned site source attached to the site-scoped ingest token.

## Netlify Declaration

`netlify.toml` declares the edge function and its path coverage:

```toml
[[edge_functions]]
  path = "/*"
  excludedPath = "/assets/*"
  function = "promptscout-live-ai-traffic"
```

You can narrow `path`, add more declarations, or exclude static asset folders to
control volume. Netlify runs declarations in file order for matching paths.

For inline path configuration instead of `netlify.toml`, export a config object
from the edge function:

```ts
export const config = {
  path: "/*",
};
```

Use either declaration style deliberately for the deployed function so route
coverage is easy to audit.
