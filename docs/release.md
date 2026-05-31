# Release

This repository publishes one public npm package:

- `@promptscout/live-ai-traffic`

The public import contract uses subpath exports from that single package:

- `@promptscout/live-ai-traffic`
- `@promptscout/live-ai-traffic/core`
- `@promptscout/live-ai-traffic/vercel-middleware`

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

## Manual Workflow

Use GitHub Actions `Release` workflow with `dry_run` set to `true` before every
real publish attempt. The dry run uses the same release gates as the publish path
and runs:

```bash
npm pack --dry-run
```

Only run the workflow with `dry_run: false` after the protected PR checks are in
place and the dry run has passed. The real publish path runs in the GitHub
environment named `npm`, grants `contents: read` and `id-token: write`, uses a
GitHub-hosted `ubuntu-latest` runner, and checks these trusted-publishing runtime
minimums before publishing:

- Node `22.14.0` or newer
- npm `11.5.1` or newer

When `dry_run: false` is selected, the workflow publishes to the public npm
registry at `https://registry.npmjs.org` with:

```bash
npm publish --access public --registry=https://registry.npmjs.org
```

Trusted publishing generates provenance for this public package automatically, so
the workflow does not pass a separate provenance flag.

After a successful real publish, verify the package version and package metadata
on npm:

```bash
npm view @promptscout/live-ai-traffic version --registry=https://registry.npmjs.org
```

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
and `./vercel-middleware` to the compiled Next.js/Vercel collector entrypoint.
It also exposes `./docs-manifest.json` for apps that need integration guide
metadata without scraping README links. Examples, tests, fixtures, local
environment files, and secrets are not published.

## Consumer Install

Install the public package from npm and pin the exact version in production
apps:

```bash
npm install @promptscout/live-ai-traffic@0.1.1
```

Use the Vercel helper through its subpath export:

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
```

Use shared event contracts and classifiers through:

```ts
import { classifyAiTraffic } from "@promptscout/live-ai-traffic/core";
```
