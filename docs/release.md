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

## Manual Workflow

Before the first public publish, the npm org owner must confirm that the
`@promptscout` scope exists, the account can publish to it, and the account has
2FA or npm publishing auth ready.

From the repository root, the owner should run the first publish manually:

```bash
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish --access public --registry=https://registry.npmjs.org
npm view @promptscout/live-ai-traffic version --registry=https://registry.npmjs.org
```

Then grant team access if needed:

```bash
npm access grant read-write @promptscout:maintainers @promptscout/live-ai-traffic --registry=https://registry.npmjs.org
npm access ls-collaborators @promptscout/live-ai-traffic --registry=https://registry.npmjs.org
```

After that first publish succeeds, configure npm Trusted Publishing for future
GitHub Actions releases:

```bash
npm trust github @promptscout/live-ai-traffic \
  --repo lukasz-starosta/promptscout-live-ai-traffic \
  --file release.yml \
  --env npm \
  --allow-publish \
  --registry=https://registry.npmjs.org
```

Use GitHub Actions `Release` workflow with `dry_run` set to `true` first. The
dry run builds package `dist` output and runs:

```bash
npm pack --dry-run
```

When `dry_run: false` is selected, the workflow publishes to the public npm
registry at `https://registry.npmjs.org` with:

```bash
npm publish --access public --provenance --registry=https://registry.npmjs.org
```

The real publish path uses npm Trusted Publishing through GitHub Actions OIDC.
The workflow grants `id-token: write`, runs in the protected GitHub environment
named `npm`, and does not require npm registry token secrets. Keep the same
verify and dry-run gates before the real publish step.

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
