#!/usr/bin/env bash
# Verify the whole stack against a throwaway local network: publish the package, then run the
# end-to-end script against it.
#
# This is the check the unit suites cannot be. It proves the BCS layouts match the Move structs,
# that the PTB builders produce transactions the vault accepts, that preview_transfer decodes, and
# that the events decode back into the shapes the indexer projects. Nothing here touches a public
# network or your ~/.sui config.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${SKUR_LOCAL_DIR:-/tmp/skur-localnet}"
export SUI_CONFIG_DIR="$WORK/suiconfig"
mkdir -p "$SUI_CONFIG_DIR"

command -v sui >/dev/null || { echo "the sui CLI is not on PATH" >&2; exit 1; }

cleanup() { [ -n "${NODE_PID:-}" ] && kill "$NODE_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "starting a local network"
sui start --force-regenesis --with-faucet --fullnode-rpc-port 9000 > "$WORK/node.log" 2>&1 &
NODE_PID=$!
for _ in $(seq 1 60); do
  sleep 2
  curl -s -m 2 -o /dev/null http://127.0.0.1:9000 2>/dev/null && break
done

sui client new-env --alias skur-local --rpc http://127.0.0.1:9000 >/dev/null 2>&1 || true
sui client switch --env skur-local >/dev/null
ADDR="$(sui client active-address)"
sui client faucet --url http://127.0.0.1:9123/gas >/dev/null
sleep 5

echo "publishing ephemerally"
# `test-publish` needs a build environment because the local chain identifier is not declared in
# Move.toml, and it should not be: it changes on every regenesis.
RESULT="$(sui client test-publish --build-env testnet "$HERE" --gas-budget 2000000000 --json)"
PACKAGE_ID="$(printf '%s' "$RESULT" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print(next((c["packageId"] for c in d.get("objectChanges", []) if c.get("type") == "published"), ""))
')"
[ -n "$PACKAGE_ID" ] || { echo "publish failed" >&2; exit 1; }
echo "package $PACKAGE_ID"

KEY="$(sui keytool export --key-identity "$ADDR" --json 2>/dev/null | python3 -c '
import json, sys
d = json.load(sys.stdin)
print(d.get("exportedPrivateKey") or d.get("key", {}).get("exportedPrivateKey") or "")
')"
[ -n "$KEY" ] || { echo "could not export the throwaway key" >&2; exit 1; }

echo "running the end-to-end script"
cd "$HERE/../sdk"
npm run --silent build
SKUR_NETWORK=localnet SKUR_PACKAGE_ID="$PACKAGE_ID" SUI_PRIVATE_KEY="$KEY" \
  node --experimental-strip-types scripts/e2e.ts
