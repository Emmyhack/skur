#!/usr/bin/env bash
# Everything CI would run, in one command, so a red check for reasons outside the code does not
# leave you without a signal. Mirrors .github/workflows/sui.yml job for job.
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0; FAIL=0
step() {
  printf '\n\033[1m── %s\033[0m\n' "$1"; shift
  if "$@"; then PASS=$((PASS+1)); printf '   \033[32mok\033[0m\n'
  else FAIL=$((FAIL+1)); printf '   \033[31mFAILED\033[0m\n'; fi
}

have() { command -v "$1" >/dev/null 2>&1; }

if have sui; then
  step "Move · build (must be warning-free)" bash -c "
    cd '$ROOT/sui'
    out=\$(sui move build 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    echo \"\$out\" | grep -qE '^(warning|error)' && { echo \"\$out\" | grep -E '^(warning|error)' -A 4; exit 1; }
    exit 0"
  step "Move · 75 tests" bash -c "cd '$ROOT/sui' && sui move test 2>&1 | tail -1 | grep -q 'Test result: OK'"
else
  printf '\n\033[33m── Move · skipped: the sui CLI is not on PATH\033[0m\n'
  printf '   get it from https://github.com/MystenLabs/sui/releases\n'
fi

step "SDK · typecheck" bash -c "cd '$ROOT/sdk' && npm run --silent typecheck"
step "SDK · build" bash -c "cd '$ROOT/sdk' && npm run --silent build"
step "SDK · tests" bash -c "cd '$ROOT/sdk' && npm run --silent test"

step "Backend · typecheck" bash -c "cd '$ROOT/server' && DATABASE_URL=unused SKUR_PACKAGE_ID=0x0 npm run --silent typecheck"
step "Backend · tests" bash -c "cd '$ROOT/server' && npm run --silent test"

# The migrations job needs a database. Skipped rather than failed when there is none, because a
# missing Postgres is not a broken migration.
if have pg_isready && pg_isready -q 2>/dev/null; then
  step "Backend · migrations against a real Postgres" bash -c "
    createdb skur_verify 2>/dev/null
    cd '$ROOT/server' && DATABASE_URL=postgres://localhost:5432/skur_verify SKUR_PACKAGE_ID=0x0 \
      node --experimental-strip-types src/migrate.ts >/dev/null
    dropdb skur_verify 2>/dev/null; exit 0"
else
  printf '\n\033[33m── Migrations · skipped: no Postgres is running\033[0m\n'
fi

step "Interface · typecheck" bash -c "cd '$ROOT/app' && npm run --silent typecheck"
step "Interface · build" bash -c "cd '$ROOT/app' && NEXT_TELEMETRY_DISABLED=1 npm run --silent build >/dev/null"

printf '\n\033[1m%s passed, %s failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
