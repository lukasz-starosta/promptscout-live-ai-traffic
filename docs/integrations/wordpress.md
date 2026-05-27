# WordPress Integration

Use the WordPress plugin collector when a site owner needs a low-code,
server-side install path for live AI traffic tracking.

## Install

Copy or package `packages/wordpress-plugin` as a WordPress plugin directory,
then activate `PromptScout Live AI Traffic` in WordPress admin. The local
example mounts the package directly:

```bash
cd examples/wordpress
docker compose up
```

## Settings

Open Settings -> PromptScout AI Traffic and configure:

- `Ingest URL`: PromptScout live AI traffic ingest endpoint.
- `Ingest token`: site-scoped token for this WordPress site.
- `Privacy mode`: do not collect IP addresses, omit IP metadata, or hash IPs
  with the WordPress auth salt before discard.
- `Debug mode`: write skipped-request and delivery-error diagnostics to the
  WordPress debug log.

The plugin stores those values in the WordPress options table and renders the
token as a password field in admin. The token is not exposed through public
scripts or markup outside the authenticated settings page.

Do not add a separate brand ID, team-site ID, or team-wide token to WordPress.
PromptScout groups accepted traffic by the brand-owned site source attached to
the ingest token.

## Runtime Behavior

The plugin hooks `template_redirect` for front-end requests, classifies the
server-side `User-Agent` and `Referer` headers with the bundled classifier rules
exported from `packages/core`, and posts normalized events using
`wp_remote_post`.

Unknown traffic is skipped by default to keep volume low. Classified events use
the shared v1 contract with:

- `sourceProvider: wordpress`
- `eventKind: request_observation`
- normalized request host, path, query, method, user agent, and referer
- provider classification fields without classifier debug metadata
- `integration.name: wordpress-plugin`

The classifier rules used by PHP are copied from
`packages/core/fixtures/classifier/php-rules-export.json` into the plugin as
`includes/classifier-rules.json`; the focused test suite verifies both files
stay identical and continue to match the committed core classifier fixtures.
