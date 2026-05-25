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

  printf 'clean\n' > README.md
  ./scripts/verify
)
