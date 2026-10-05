#!/usr/bin/env bash
# Publish the Skur package and record where it landed.
#
# Usage: scripts/publish.sh [testnet|devnet|localnet|mainnet]
#
# Writes deployments/<network>.json, which is the only place an address is configured. Nothing in
# the app, the SDK or the backend hardcodes a package id.
set -euo pipefail

NETWORK="${1:-testnet}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$HERE/deployments/$NETWORK.json"

command -v sui >/dev/null || { echo "the sui CLI is not on PATH" >&2; exit 1; }

echo "building"
sui move build --path "$HERE"

echo "testing before publishing"
sui move test --path "$HERE"

echo "switching to $NETWORK"
sui client switch --env "$NETWORK" >/dev/null

ADDRESS="$(sui client active-address)"
echo "publishing as $ADDRESS"

RESULT="$(sui client publish --path "$HERE" --gas-budget 500000000 --json)"

PACKAGE_ID="$(printf '%s' "$RESULT" | python3 -c '
import json,sys
d = json.load(sys.stdin)
for c in d.get("objectChanges", []):
    if c.get("type") == "published":
        print(c["packageId"]); break
')"
DIGEST="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("digest",""))')"

[ -n "$PACKAGE_ID" ] || { echo "could not find the published package id in the output" >&2; exit 1; }

python3 - "$OUT" "$NETWORK" "$PACKAGE_ID" "$DIGEST" "$ADDRESS" <<'PY'
import json, sys, datetime
out, network, package, digest, deployer = sys.argv[1:6]
json.dump({
    "network": network,
    "packageId": package,
    "publishedAtDigest": digest,
    "deployer": deployer,
    "publishedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "vaults": [],
}, open(out, "w"), indent=2)
print(f"wrote {out}")
PY

echo
echo "package: $PACKAGE_ID"
echo "explorer: https://suiscan.xyz/$NETWORK/object/$PACKAGE_ID"
