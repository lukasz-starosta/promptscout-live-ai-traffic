# nginx Log Forwarder Integration

`promptscout-live-ai-traffic-nginx-log-forwarder` supports customers who can
read origin nginx access logs but do not want a request-path proxy integration.
It parses common or JSON nginx access logs, classifies requests with
`packages/core`, batches PromptScout events, and stores byte-offset checkpoints
so restarts do not resend the whole log.

The forwarder uses `promptscout-live-ai-traffic-nginx-log-forwarder`, a
repo-local private workspace package. It is not published as a separate npm
package and is not exported from `@promptscout/live-ai-traffic` yet. Treat this
guide as a repository-local example until a public collector subpath is added.

## Supported Log Formats

The parser accepts:

- nginx common access log lines, including the combined-log referer and
  user-agent fields when present.
- JSON access log lines with common nginx field names such as `time_iso8601`,
  `remote_addr`, `host`, `request`, `request_method`, `request_uri`,
  `http_user_agent`, and `http_referer`.

Malformed lines return structured parser errors instead of throwing. The
forwarder pass skips malformed lines after counting them, forwards only
classified AI traffic by default, and advances the checkpoint through complete
lines after successful batch delivery.

## Local Docker Demo

`examples/nginx-docker` starts nginx, the forwarder, and a mocked PromptScout
ingest endpoint. It is safe to run locally because the default endpoint is the
mock service inside Docker Compose.

```bash
docker compose -f examples/nginx-docker/docker-compose.yml up --build
curl -A "OAI-SearchBot/1.0" http://localhost:8088/docs
curl -A "ClaudeBot/1.0" http://localhost:8088/pricing
curl -A "PerplexityBot/1.0" http://localhost:8088/blog
curl -A "Mozilla/5.0" http://localhost:8088/
```

The mock ingest service prints batches for the AI crawler requests. Normal
browser traffic is parsed and checkpointed but not forwarded unless
`includeUnclassified` is enabled.

## Setup Probe

Setup probe support is not available for the nginx log forwarder yet. The
forwarder reads completed access-log lines after requests reach nginx, so it
cannot intercept `__promptscout/setup-probe` in the live request path or return
a probe response to PromptScout. Integration completion still requires the first
real live AI traffic `request_observation` event.
