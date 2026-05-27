# Release

This repository uses one version across the root package, every package under
`packages/*`, and every runnable example under `examples/*`.

The current release path is private GitHub Packages publishing for PromptScout
consumption. Public npm publishing remains out of scope: packages are scoped to
the GitHub account that owns this repository, publish to `npm.pkg.github.com`,
and use restricted access.

## Chosen Private Path

The publishable private package scope is `@lukasz-starosta`. GitHub Packages
requires scoped npm package names to use the account or organization namespace,
and this repository is owned by `lukasz-starosta/promptscout-live-ai-traffic`.

The manual `Release` workflow publishes only the packages required by the
Next.js/Vercel install path:

- `@lukasz-starosta/promptscout-live-ai-traffic-core`
- `@lukasz-starosta/promptscout-live-ai-traffic-vercel-middleware`

Other provider package manifests are also configured for GitHub Packages, but
the workflow intentionally does not publish placeholder or unrelated packages.
Examples remain private workspaces and are never published.

## Required Checks

Run the repo-owned verifier before preparing a release candidate:

```bash
./scripts/verify
```

The GitHub release workflow also runs install, lint, typecheck, unit tests,
`./scripts/verify`, and `yarn build` before any package dry run or private
publish command.

## Manual Workflow

Use GitHub Actions `Release` workflow with `dry_run` set to `true` first. The
dry run builds package `dist` output and runs `yarn pack --dry-run` for the core
and Vercel middleware packages so tarball contents are inspectable before
publishing.

When `dry_run: false` is selected, the workflow uses the repository
`GITHUB_TOKEN` with:

```yaml
permissions:
  contents: read
  packages: write
```

The publish command is `yarn npm publish --access restricted`, and package
manifests set `publishConfig.registry` to `https://npm.pkg.github.com`. The
workflow does not use `NPM_TOKEN`, `registry.npmjs.org`, or `--access public`.
That keeps public npm publishing out of this private consumption path.

GitHub Packages creates npm packages as private on first publish. Because each
published package includes a `repository` field pointing at this repository, the
package can inherit repository access and the repository workflow can publish
with `GITHUB_TOKEN`.

## PromptScout Install Auth

For local PromptScout consumption, create or update the consuming app's
`.npmrc` without committing a real token:

```ini
@lukasz-starosta:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
always-auth=true
```

`GITHUB_PACKAGES_TOKEN` should be a classic GitHub personal access token with
`read:packages` and read access to `lukasz-starosta/promptscout-live-ai-traffic`
or to the private package. If the package is later granted direct repository
access to the PromptScout repo, GitHub Actions in that repo may use its own
`GITHUB_TOKEN` for installs.

For Yarn 4 consumers, prefer `.yarnrc.yml` token wiring because modern Yarn uses
Yarn config for npm auth:

```yaml
npmScopes:
  lukasz-starosta:
    npmAlwaysAuth: true
    npmRegistryServer: "https://npm.pkg.github.com"
npmRegistries:
  //npm.pkg.github.com:
    npmAuthToken: "${GITHUB_PACKAGES_TOKEN}"
```

Install pinned package versions rather than floating ranges:

```bash
yarn add \
  @lukasz-starosta/promptscout-live-ai-traffic-core@0.0.0 \
  @lukasz-starosta/promptscout-live-ai-traffic-vercel-middleware@0.0.0
```

For npm:

```bash
npm install \
  @lukasz-starosta/promptscout-live-ai-traffic-core@0.0.0 \
  @lukasz-starosta/promptscout-live-ai-traffic-vercel-middleware@0.0.0
```

Keep the version pin exact in PromptScout until the package promotion process is
formalized. Each new private publish must move to a new semver version because
the npm registry does not allow replacing an already-published version.

## Package Contents

Published JavaScript packages include only `dist` through each package
manifest's `files` allowlist. Runtime entrypoints and types are exported from:

- `./dist/index.js`
- `./dist/index.d.ts`

Examples, tests, docs, fixtures, local `.env` files, and secrets are excluded
from the package tarballs.

## Non-JS Artifacts

The implemented WordPress plugin lives in `packages/wordpress-plugin`, but this
issue does not publish a plugin zip. If a future private release needs one,
build the zip from the same committed version after `./scripts/verify` passes
and attach it to a GitHub release with a checksum.

This repository does not publish Docker images today. If a collector or
forwarder later needs an image, add an explicit dry-run/build gate before
pushing an image tag.
