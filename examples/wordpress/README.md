# WordPress Example

This example mounts the local PromptScout WordPress plugin into a stock
WordPress container for install smoke testing.

```bash
cd examples/wordpress
docker compose up
```

Open <http://localhost:8080>, finish the WordPress installer, then activate
`PromptScout Live AI Traffic` from the Plugins screen.

In Settings -> PromptScout AI Traffic, configure:

- `Ingest URL`: the PromptScout live AI traffic ingest endpoint.
- `Ingest token`: the site-scoped token for this brand-owned website source.
- `Privacy mode`: whether to omit IP metadata, record that IPs are not
  collected, or send a one-way HMAC hash.
- `Debug mode`: optional WordPress debug log entries for skipped requests and
  delivery errors.

The plugin does not ask for a brand ID or team-site ID. PromptScout groups
traffic by the brand-owned site source attached to the ingest token.

To smoke test classification without a live PromptScout endpoint, point the
ingest URL at a local request bin and request the site with an AI crawler user
agent:

```bash
curl -A "GPTBot/1.3" http://localhost:8080/
```
