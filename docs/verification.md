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
- monorepo scaffold checks for package, example, and docs placeholders;
- Bash syntax checks for shell scripts;
- focused Node tests under `tests/*.test.mjs`, including the core package
  TypeScript build performed by the event contract test;
- focused shell tests under `tests/*.sh`.

The command scans tracked files and untracked, non-ignored files so newly added
source files are checked before they are committed.

## What It Does Not Cover

This repository does not have an application stack yet, so the verifier does
not run repo-wide TypeScript builds, package builds, browser tests, live
provider calls, or API E2E checks. Those checks should be added behind the same
`./scripts/verify` entry point when the relevant stack lands in later issues.

## CI Contract

GitHub Actions runs the cheap verification path on pull requests and pushes to
`main`. The workflow uses the committed Yarn lockfile contract and runs:

```bash
corepack enable
yarn install --immutable
yarn lint
yarn typecheck
yarn test
./scripts/verify
```

CI intentionally does not require secrets and does not run live provider checks,
network E2E, release automation, or PromptScout application/Supabase checks.
Those remain local/manual follow-ups until the repository has the corresponding
runtime surface.

## Intentionally Empty Packages

Most provider and example packages are structure-only placeholders. Each
placeholder provider imports `@promptscout/live-ai-traffic-core` and each
placeholder example imports its matching provider package, but runtime behavior
is intentionally deferred. Runtime adapters such as `packages/node-middleware`
must add focused tests that prove response behavior and ingest scheduling.

## Symphony Contract

Symphony can use `./scripts/verify` as the repo-owned pre-PR and final preflight
command. The command is cheap, deterministic, and does not require network
access or external services.
