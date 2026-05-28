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

Use GitHub Actions `Release` workflow with `dry_run` set to `true` first. The
dry run builds package `dist` output and runs:

```bash
npm pack --dry-run
```

When `dry_run: false` is selected, the workflow publishes to the public npm
registry at `https://registry.npmjs.org` with:

```bash
npm publish --access public
```

The workflow expects `NPM_TOKEN` to be configured as a repository secret. A
granular npm automation or publishing token is preferred. If npm trusted
publishing is adopted later, keep the same verify and dry-run gates before the
real publish step.

## Package Contents

The public package manifest allows only these package contents:

- `dist`
- `README.md`
- `LICENSE`
- package metadata automatically included by npm

The `exports` map points `.` and `./core` to the compiled shared core entrypoint,
and `./vercel-middleware` to the compiled Next.js/Vercel collector entrypoint.
Examples, tests, docs, fixtures, local environment files, and secrets are not
published.

## Consumer Install

Install the public package from npm and pin the exact version in production
apps:

```bash
npm install @promptscout/live-ai-traffic@0.1.0
```

Use the Vercel helper through its subpath export:

```ts
import { trackPromptScoutAiTraffic } from "@promptscout/live-ai-traffic/vercel-middleware";
```

Use shared event contracts and classifiers through:

```ts
import { classifyAiTraffic } from "@promptscout/live-ai-traffic/core";
```
