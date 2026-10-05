#!/usr/bin/env bash
# Run the Move test suite, with coverage when the CLI was built with it.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v sui >/dev/null || { echo "the sui CLI is not on PATH" >&2; exit 1; }
sui move test --path "$HERE" "$@"
