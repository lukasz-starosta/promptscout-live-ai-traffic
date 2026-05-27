#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY_SCRIPT="$ROOT/scripts/verify"

if [[ ! -x "$VERIFY_SCRIPT" ]]; then
  echo "Missing executable verify script at scripts/verify" >&2
  exit 1
fi

"$VERIFY_SCRIPT" --help >/dev/null
bash -n "$VERIFY_SCRIPT"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

write_minimal_scaffold() {
  local repo="$1"
  local providers=(
    vercel
    cloudflare
    cloudflare-worker
    netlify-edge
    netlify
    nginx-log-forwarder
    wordpress
    node-express
    cloudfront-aws
    fastly
  )

  cat >"$repo/package.json" <<'JSON'
{
  "name": "promptscout-live-ai-traffic",
  "private": true,
  "workspaces": [
    "packages/*",
    "examples/*"
  ]
}
JSON
  cat >"$repo/tsconfig.json" <<'JSON'
{
  "files": []
}
JSON
  cat >"$repo/tsconfig.base.json" <<'JSON'
{
  "compilerOptions": {
    "strict": true
  }
}
JSON
  cat >"$repo/biome.json" <<'JSON'
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json"
}
JSON

  mkdir -p "$repo/packages/core/src" "$repo/docs/integrations"
  printf 'core\n' >"$repo/packages/core/src/index.ts"
  printf '{ "extends": "../../tsconfig.base.json" }\n' >"$repo/packages/core/tsconfig.json"
  cat >"$repo/packages/core/package.json" <<'JSON'
{
  "name": "@promptscout/live-ai-traffic-core",
  "version": "0.0.0"
}
JSON
  printf 'getting started\n' >"$repo/docs/getting-started.md"

  for provider in "${providers[@]}"; do
    mkdir -p "$repo/packages/$provider/src" "$repo/examples/$provider/src"
    printf 'import "@promptscout/live-ai-traffic-core";\n' >"$repo/packages/$provider/src/index.ts"
    cat >"$repo/packages/$provider/package.json" <<JSON
{
  "name": "@promptscout/live-ai-traffic-$provider",
  "version": "0.0.0",
  "dependencies": {
    "@promptscout/live-ai-traffic-core": "workspace:*"
  }
}
JSON
    printf '{ "extends": "../../tsconfig.base.json" }\n' >"$repo/packages/$provider/tsconfig.json"
    cat >"$repo/examples/$provider/package.json" <<JSON
{
  "name": "@promptscout/live-ai-traffic-example-$provider",
  "version": "0.0.0",
  "dependencies": {
    "@promptscout/live-ai-traffic-$provider": "workspace:*"
  }
}
JSON
    printf 'import "@promptscout/live-ai-traffic-%s";\n' "$provider" >"$repo/examples/$provider/src/index.ts"
    printf '{ "extends": "../../tsconfig.base.json" }\n' >"$repo/examples/$provider/tsconfig.json"
    printf '# %s example\n' "$provider" >"$repo/examples/$provider/README.md"
    printf '# %s integration\n' "$provider" >"$repo/docs/integrations/$provider.md"
  done
}

mkdir -p "$TMP_DIR/repo/scripts"
cp "$VERIFY_SCRIPT" "$TMP_DIR/repo/scripts/verify"
chmod +x "$TMP_DIR/repo/scripts/verify"

(
  cd "$TMP_DIR/repo"
  git init --quiet
  git config user.email "verify@example.test"
  git config user.name "Verify Test"

  printf 'bad trailing whitespace \n' > README.md
  if ./scripts/verify >"$TMP_DIR/verify.out" 2>"$TMP_DIR/verify.err"; then
    echo "Expected scripts/verify to fail on trailing whitespace" >&2
    exit 1
  fi
  grep -q "trailing whitespace" "$TMP_DIR/verify.err"

  printf 'extra blank eof\n\n' > README.md
  if ./scripts/verify >"$TMP_DIR/verify.out" 2>"$TMP_DIR/verify.err"; then
    echo "Expected scripts/verify to fail on extra blank line at EOF" >&2
    exit 1
  fi
  grep -q "extra blank line at EOF" "$TMP_DIR/verify.err"

  printf '\n\n' > README.md
  if ./scripts/verify >"$TMP_DIR/verify.out" 2>"$TMP_DIR/verify.err"; then
    echo "Expected scripts/verify to fail on blank-line-only text files" >&2
    exit 1
  fi
  grep -q "extra blank line at EOF" "$TMP_DIR/verify.err"

  printf 'clean\n' > README.md
  if ./scripts/verify >"$TMP_DIR/verify.out" 2>"$TMP_DIR/verify.err"; then
    echo "Expected scripts/verify to fail when the monorepo scaffold is missing" >&2
    exit 1
  fi
  grep -q "Missing required path: package.json" "$TMP_DIR/verify.err"

  write_minimal_scaffold "$TMP_DIR/repo"
  ./scripts/verify
)
