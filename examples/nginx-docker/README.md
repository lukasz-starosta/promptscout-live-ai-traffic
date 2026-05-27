# nginx Docker Compose Example

This example demonstrates local nginx access-log forwarding without sending live
network traffic to PromptScout. Docker Compose starts:

- `nginx`, writing JSON access logs to a shared volume.
- `mock-ingest`, a local HTTP endpoint that prints received batches.
- `forwarder`, a Node process that reads new nginx log bytes, batches classified
  AI traffic, posts to the mock endpoint, and stores a checkpoint in a volume.

## Run

From the repository root:

```bash
docker compose -f examples/nginx-docker/docker-compose.yml up --build
```

Generate sample traffic in another shell:

```bash
curl -A "OAI-SearchBot/1.0" http://localhost:8088/docs
curl -A "ClaudeBot/1.0" http://localhost:8088/pricing
curl -A "PerplexityBot/1.0" http://localhost:8088/blog
curl -A "Mozilla/5.0" http://localhost:8088/
```

The mock ingest logs should show batches for the AI crawlers. The browser request
is parsed and checkpointed but not forwarded by default.
