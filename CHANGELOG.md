# Changelog

All notable changes to `@promptscout/live-ai-traffic` will be documented here.

This project publishes one public npm package. Internal provider workspaces and
examples use the same version for traceability, but remain private and are not
published.

## 0.1.1

- Preserved safe landing query attribution for query-classified AI referral
  visits as a closed `request.search` value such as `?utm_source=chatgpt.com`.
- Kept raw landing query strings, unsafe query keys, prompt text, tokens, email
  values, referer query strings, and fragments out of events before ingest.
- Documented the package payload contract for PromptScout to consume in the
  PS-311 follow-up.

## 0.1.0

- Switched to the single public npm package `@promptscout/live-ai-traffic`.
- Added public subpath exports for `.`, `./core`, and `./vercel-middleware`.
- Replaced the old private package release path with public npm publishing.
