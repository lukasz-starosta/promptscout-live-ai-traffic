# Release

This repository publishes one public npm package:

- `@promptscout/live-ai-traffic`

The public import contract uses subpath exports from that single package:

- `@promptscout/live-ai-traffic`
- `@promptscout/live-ai-traffic/core`
- `@promptscout/live-ai-traffic/vercel-middleware`
- `@promptscout/live-ai-traffic/cloudflare-worker`
- `@promptscout/live-ai-traffic/cloudflare-deploy`
- `@promptscout/live-ai-traffic/docs-content`

Internal workspace packages remain private implementation units. They are not
published as separate npm packages.

## Version

The first public npm version is `0.1.0`. Do not publish `0.0.0`; npm versions
cannot be replaced after publication.

## Required Checks

Run the repo-owned verifier before preparing a release candidate:

```bash
./scripts/verify
```

The GitHub release workflow also runs install, lint, typecheck, unit tests,
`./scripts/verify`, and `yarn build` before any package dry run or publish
command.

## Trusted Publishing Setup

The public package is released from GitHub Actions through npm Trusted
Publishing. The npm package owner must configure this trusted publisher for
`@promptscout/live-ai-traffic`:

- Publisher: GitHub Actions
- GitHub organization/user: `lukasz-starosta`
- Repository: `promptscout-live-ai-traffic`
- Workflow filename: `release.yml`
- Environment name: `npm`
- Allowed action: `npm publish`

The GitHub repository must also have an environment named `npm` before the first
real trusted publish. Configure intentional protection rules there, such as a
required reviewer and selected deployment branches or tags, or record the
decision to leave the environment unprotected. Do not add npm publishing secrets
to that environment.

The root package manifest must keep this repository URL because npm validates it
for GitHub trusted publishing:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/lukasz-starosta/promptscout-live-ai-traffic.git"
}
```

Use npm's CLI setup only when configuring or inspecting the trusted publisher.
The `npm trust` command may require a newer local npm than the publish workflow's
minimum runtime:

```bash
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm trust github @promptscout/live-ai-traffic \
  --repo lukasz-starosta/promptscout-live-ai-traffic \
  --file release.yml \
  --env npm \
  --allow-publish \
  --registry=https://registry.npmjs.org
```

## Release Workflow

Stable releases are tag-based. Do not publish on every merge to `main`; most
merges are not package releases, and npm package versions cannot be replaced
after publication. A release is intentional only when a maintainer pushes a
version tag such as `v0.1.3`.

Use `main` as the stable release source. Prepare release changes in a normal PR,
merge that PR to `main`, then tag the `main` commit. `develop` can be used for
integration work and manual dry runs, but stable npm releases should first merge
through `main`. Prerelease publishing from `develop` requires a separate
dist-tag policy such as `next`; this workflow intentionally rejects prerelease
versions until that policy exists.

The `Release` workflow supports two entry points:

- `workflow_dispatch`: manual dry runs from a branch or tag.
- `push` tags matching `v*`: real package releases.

The dry run uses the same release gates as the publish path and runs:

```bash
npm pack --dry-run
```

The real publish path runs in the GitHub environment named `npm`, grants
`contents: write` for GitHub Release creation and `id-token: write` for npm
Trusted Publishing, uses a GitHub-hosted `ubuntu-latest` runner, and checks
these trusted-publishing runtime minimums before publishing:

- Node `22.14.0` or newer
- npm `11.5.1` or newer

Before publishing from a tag, `scripts/verify-release-tag.mjs` verifies:

- the workflow ref is a tag named `v<package.json version>`;
- the package version is a stable `x.y.z` version, not a prerelease;
- the tag commit is reachable from `origin/main`;
- the exact npm package version is not already published.

When the guard passes, the workflow publishes to the public npm registry at
`https://registry.npmjs.org` with:

```bash
npm publish --access public --registry=https://registry.npmjs.org
```

Trusted publishing generates provenance for this public package automatically, so
the workflow does not pass a separate provenance flag. After publish, the
workflow verifies the npm version and creates a GitHub Release for the tag.

## Stable Release Runbook

1. Prepare a release PR from `main`.

   Update `package.json`, package docs, examples, version-pinned tests, and
   `CHANGELOG.md` for the new version.

2. Run local verification before opening or merging the PR.

   ```bash
   ./scripts/verify
   yarn test
   yarn build
   npm pack --dry-run
   ```

3. Merge the release PR to `main` after required checks pass.

4. Update local `main`, then create and push an annotated tag:

   ```bash
   git checkout main
   git pull --ff-only origin main
   git tag -a v0.1.3 -m "Release v0.1.3"
   git push origin v0.1.3
   ```

5. Approve the npm environment deployment in GitHub Actions if approval is
   required. The environment name in GitHub must be exactly `npm`.

6. Verify the package version and package metadata on npm:

```bash
npm view @promptscout/live-ai-traffic version --registry=https://registry.npmjs.org
```

7. Smoke-test a clean consumer install:

```bash
npm install @promptscout/live-ai-traffic@0.1.3
node --input-type=module -e "const m = await import('@promptscout/live-ai-traffic/vercel-middleware'); console.log(typeof m.trackPromptScoutAiTraffic)"
```

## Manual Dry Runs

Use GitHub Actions `Release` workflow with `dry_run` set to `true` before every
real publish attempt. Manual dry runs can target `main`, a release PR branch, or
`develop`. Manual dry runs never publish from a branch. To publish manually,
select a `v*` tag ref and set `dry_run: false`; the same tag guard still runs.

## Failure Recovery

If verification fails before `npm publish`, fix the release PR and move the tag:

```bash
git tag -d v0.1.3
git push origin :refs/tags/v0.1.3
git tag -a v0.1.3 -m "Release v0.1.3"
git push origin v0.1.3
```

Only do this before publication. If `npm publish` succeeds, the version is
immutable. Fix forward with a new patch version such as `v0.1.3`.

After trusted publishing succeeds, restrict legacy token publishing in npm
package settings and revoke any old automation publish token that was used only
for this package.

## Package Contents

The public package manifest allows only these package contents:

- `dist`
- `docs`
- `docs-manifest.json`
- `README.md`
- `LICENSE`
- package metadata automatically included by npm

The `exports` map points `.` and `./core` to the compiled shared core entrypoint,
`./vercel-middleware` to the compiled Next.js/Vercel collector, and
`./cloudflare-worker` to the customer-composable Worker collector. The generated
`./cloudflare-deploy` module contains the standalone managed-install script and
its versioned checksum manifest. The generated `./docs-content` module contains
typed guide metadata and markdown from the package sources, so
consumers do not need bundler-specific markdown loaders. The raw
`./docs-manifest.json` and `./docs/*` paths remain available for non-JavaScript
consumers. Examples, tests, fixtures, local environment files, and secrets are
not published.

## Consumer Install

Install the public package from npm and pin the exact version in production
apps:

```bash
npm install @promptscout/live-ai-traffic@0.1.3
```

Use the Vercel helper through its subpath export:

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
```

Use shared event contracts and classifiers through:

```ts
import { classifyAiTraffic } from "@promptscout/live-ai-traffic/core";
```
