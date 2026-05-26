# PromptScout Live AI Traffic

Repository for the PromptScout live AI traffic packages and examples.

## Workspace Layout

This repository uses Yarn workspaces:

- `packages/core` contains shared placeholder code and the canonical live AI
  traffic event contract for all integrations.
- `packages/*` contains one provider package per integration.
- `examples/*` contains one minimal workspace example per provider.
- `docs/getting-started.md` and `docs/integrations/*` hold the initial docs shell.

Provider and example packages are intentionally private placeholders until
runtime implementation work lands in later issues.

## Verification

Run the repo-owned verification command before pushing changes:

```bash
./scripts/verify
```

The command is intentionally lightweight while the repository is in its
foundation phase. It checks repository text formatting, scaffold completeness,
shell script syntax, and focused verifier tests. See
[docs/verification.md](docs/verification.md) for the full contract and current
non-goals.

The shared request observation schema is documented in
[docs/event-contract.md](docs/event-contract.md). These events are analytics
observations, not proof that an AI answer mentioned a brand or page.
