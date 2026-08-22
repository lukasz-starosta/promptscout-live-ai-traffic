# Verification

`promptscout-live-ai-traffic` exposes one deterministic local verification
surface:

```bash
./scripts/verify
```

## What It Covers

The verifier is designed for clean checkouts and short-lived Symphony
worktrees. It currently runs:

- repository text formatting checks for trailing whitespace and exactly one
  final newline;
- monorepo scaffold checks for package, example, and docs surfaces;
- Bash syntax checks for shell scripts;
- a Cloudflare Workers Vitest suite that executes the generated artifact inside
  `workerd` with outbound origin and ingest requests intercepted locally;
- Wrangler's integration test harness against the production bundle, with MSW
  rejecting unhandled network requests;
- focused Node tests under `tests/*.test.mjs`, including the core package
  TypeScript build performed by the event contract test. Test files run
  serially because package/install tests rebuild the shared root `dist`
  directory and must not race runtime-import tests;
- focused shell tests under `tests/*.sh`.

The command scans tracked files and untracked, non-ignored files so newly added
source files are checked before they are committed.

## What It Does Not Cover

This repository does not have an application stack, so the verifier does not
run browser tests, live provider calls, or PromptScout API E2E checks. The
Cloudflare suites use local runtime and HTTP fixtures. A separate credentialed
smoke against a PromptScout-owned Cloudflare zone remains a release gate for
the managed installer.

## CI Contract

GitHub Actions runs the verification path on pull requests and pushes to
`main`. The workflow uses the committed Yarn lockfile contract and runs:

```bash
corepack enable
yarn install --immutable
yarn lint
yarn typecheck
yarn build
yarn test
./scripts/verify
```

## Required PR Checks

GitHub branch protection for `main` must bind to these stable required status
checks from the `Verify` workflow. Keep these job names unique across all workflows.
GitHub required checks bind to check names, and duplicate job names can make merge
gates ambiguous.

- `Live traffic verification`
- `Release readiness package dry run`

The release-readiness job depends on verification, rebuilds the package output,
and runs:

```bash
npm pack --dry-run
```

CI intentionally does not require secrets and does not run live provider checks,
network E2E, release automation, or PromptScout application/Supabase checks.
Those remain local/manual follow-ups until the repository has the corresponding
runtime surface.

## Release Workflow Contract

GitHub Actions also exposes a tag-based `Release` workflow. It runs the same
install, lint, typecheck, unit test, and `./scripts/verify` checks before any
package dry run or public publish command. Manual dispatch remains available
for dry runs from branches or tags. The real publish path is a `v*` tag push
from `main` and targets the public npm registry for
`@promptscout/live-ai-traffic`.

The release workflow guards real publishes with `scripts/verify-release-tag.mjs`
before `npm publish`. The guard checks that the tag matches
`package.json`, the version is stable, the tag commit is reachable from
`origin/main`, and the version is not already present on npm. A successful
publish also creates a GitHub Release for the tag.

## Intentionally Empty Packages

Some generic provider and example packages are structure-only placeholders. Each
placeholder provider imports
`@promptscout/live-ai-traffic/core` and each placeholder example
imports its matching provider package, but runtime behavior is intentionally
deferred except for implemented Vercel middleware, Cloudflare Worker,
CloudFront/AWS, Netlify Edge, nginx log forwarder, WordPress plugin, Fastly
Compute, and generic Node middleware paths. Runtime adapters such as
`packages/node-middleware` must add focused tests that prove response behavior
and ingest scheduling.

## Symphony Contract

Symphony can use `./scripts/verify` as the repo-owned pre-PR and final preflight
command. The command is cheap, deterministic, and does not require network
access or external services.
