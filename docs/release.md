# Release

This repository uses one version across the root package, every package under
`packages/*`, and every runnable example under `examples/*`.

PromptScout is not publishing npm packages from this repository yet. Version
`0.0.0` is intentional while the repo is in local-first dogfood mode. The
manual release workflow is available for dry-run package validation, but
`dry_run: false` is deferred until the public release gate below is satisfied.
Examples stay private so they can pin stable package versions in docs without
being published.

## Required Checks

Run the repo-owned verifier before preparing a release candidate:

```bash
./scripts/verify
```

The GitHub release workflow also runs install, lint, typecheck, unit tests,
`./scripts/verify`, and `yarn build` before any package dry run or future
publish command.

## JavaScript packages

Provider packages under `packages/*` are the future npm publishing unit under
the `@promptscout/live-ai-traffic-*` scope. They are not public packages today.

Use GitHub Actions `Release` workflow with `dry_run` set to `true` only for
release-candidate validation. The dry run builds package `dist` output and runs
`yarn pack --dry-run` for every provider package.

Do not treat a passing dry run as approval to publish. A real package release
requires all of the following:

1. The root, package, example, and changelog versions have moved off `0.0.0`.
2. The implemented local install targets have copyable customer docs that no
   longer depend on workspace-only assumptions.
3. Placeholder package shells are either implemented, excluded from publishing,
   or explicitly documented as non-customer packages for that release.
4. The install matrix identifies current package names, deferred placeholders,
   and token-scoped source binding for every public path.
5. Release ownership has approved `dry_run: false` and configured the
   repository `NPM_TOKEN` secret.

Only after those gates are true should the release workflow run with
`dry_run: false`. The future publish step uses `yarn npm publish --access
public` for packages under `packages/*` so Yarn can resolve workspace
dependencies into publishable package versions.

## WordPress artifacts

The generic `packages/wordpress` workspace is a JavaScript placeholder package.
The implemented plugin lives in `packages/wordpress-plugin`, but this repo is
not publishing a public plugin zip yet. For a future public release, build the
plugin artifact from the same committed version as the package release, attach
the zip to the GitHub release, and document its checksum in this changelog.

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
use workspace dependencies and local tarballs so local development and
verification remain deterministic.
