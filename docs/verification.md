# Verification

`promptscout-live-ai-traffic` exposes one deterministic local verification
surface:

```bash
./scripts/verify
```

## What It Covers

The first version is dependency-free and designed for clean checkouts and
short-lived Symphony worktrees. It currently runs:

- repository text formatting checks for trailing whitespace and exactly one
  final newline;
- Bash syntax checks for shell scripts;
- focused shell tests under `tests/*.sh`.

The command scans tracked files and untracked, non-ignored files so newly added
source files are checked before they are committed.

## What It Does Not Cover

This repository does not have an application stack yet, so the verifier does
not run TypeScript, package builds, browser tests, live provider calls, or API
E2E checks. Those checks should be added behind the same `./scripts/verify`
entry point when the relevant stack lands in later issues.

## Symphony Contract

Symphony can use `./scripts/verify` as the repo-owned pre-PR and final preflight
command. The command is cheap, deterministic, and does not require network
access or external services.
