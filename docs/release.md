# Release

This repository uses one version across the root package, every package under
`packages/*`, and every runnable example under `examples/*`. Published packages
use the `@promptscout/live-ai-traffic-*` npm scope. Examples stay private so
they can pin stable package versions in docs without being published.

## Required Checks

Run the repo-owned verifier before preparing or publishing a release:

```bash
./scripts/verify
```

The GitHub release workflow also runs install, lint, typecheck, unit tests,
`./scripts/verify`, and `yarn build` before any publish command.

## JavaScript packages

Provider packages under `packages/*` are the npm publishing unit. A release
starts by updating the shared version in the root package, all provider package
manifests, all example manifests, and `CHANGELOG.md`.

Use GitHub Actions `Release` workflow with `dry_run` set to `true` for release
candidate validation. The dry run builds package `dist` output and runs
`yarn pack --dry-run` for every provider package.

After the dry run passes and the version is no longer `0.0.0`, run the same
workflow with `dry_run` set to `false`. Real publishes require the repository
secret `NPM_TOKEN`. The workflow publishes every package under `packages/*` with
`yarn npm publish --access public` so Yarn can resolve workspace dependencies
into publishable package versions.

## WordPress artifacts

The current WordPress workspace is a JavaScript placeholder package, not a
ship-ready WordPress plugin zip. When the WordPress runtime lands, build the
plugin artifact from the same committed version as the npm packages, attach the
zip to the GitHub release, and document its checksum in this changelog.

Do not publish browser-visible secrets, ingest tokens, local `.env` files, or
customer configuration in the WordPress artifact. The artifact must be generated
after `./scripts/verify` has passed.

## Docker images

This repository does not publish Docker images today. If a collector or
forwarder later needs an image, use the same repository version as the tag,
for example `ghcr.io/promptscout/live-ai-traffic-nginx-log-forwarder:vX.Y.Z`.

Docker image builds must run after the same release verification gate. Add the
image build and push steps to the release workflow only when a Dockerfile lands,
and keep dry-run validation available before pushing an image tag.

## Stable Documentation References

Docs and examples may reference `@promptscout/live-ai-traffic-*` packages by
published semver after the first non-placeholder release. Until then, examples
use workspace dependencies so local development and verification remain
deterministic.
