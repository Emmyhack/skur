#!/usr/bin/env bash
# Publish the Skur package and record where it landed.
#
# Usage: scripts/publish.sh [testnet|mainnet|<env>]
#
# `mainnet` and `testnet` are system environments and work with no configuration. Any other
# environment — a devnet, a local network — has to be declared in Move.toml with its chain
# identifier, because those identifiers are not fixed. `sui client test-publish --build-env
# testnet` publishes ephemerally instead, which is what the local verification uses.
#
# The authoritative record of the published address is Published.toml, written by the CLI and
# committed to source control so other packages can depend on this one. This script additionally
# writes deployments/<network>.json, which is the single place the interface, the SDK and the
# backend read an address from.
set -euo pipefail

NETWORK="${1:-testnet}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$HERE/deployments/$NETWORK.json"

command -v sui >/dev/null || { echo "the sui CLI is not on PATH" >&2; exit 1; }

echo "building"
sui move build --path "$HERE"

# Publishing a package whose tests fail is the one mistake this script will not let you make.
echo "testing before publishing"
sui move test --path "$HERE"

echo "switching to $NETWORK"
sui client switch --env "$NETWORK" >/dev/null

ADDRESS="$(sui client active-address)"
CHAIN="$(sui client chain-identifier 2>/dev/null | awk '/Hex:/ {print $2}')"
echo "publishing as $ADDRESS on chain $CHAIN"

RESULT="$(sui client publish "$HERE" --gas-budget 2000000000 --json)"

PACKAGE_ID="$(printf '%s' "$RESULT" | python3 -c '
import json, sys
d = json.load(sys.stdin)
for c in d.get("objectChanges", []):
    if c.get("type") == "published":
        print(c["packageId"]); break
')"
DIGEST="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("digest",""))')"
STATUS="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("effects",{}).get("status",{}).get("status",""))')"

[ "$STATUS" = "success" ] || { echo "publish did not succeed: $STATUS" >&2; exit 1; }
[ -n "$PACKAGE_ID" ] || { echo "could not find the published package id in the output" >&2; exit 1; }

python3 - "$OUT" "$NETWORK" "$PACKAGE_ID" "$DIGEST" "$ADDRESS" "$CHAIN" <<'PY'
import json, sys, datetime, os
out, network, package, digest, deployer, chain = sys.argv[1:7]
existing = {}
if os.path.exists(out):
    try:
        existing = json.load(open(out))
    except Exception:
        pass
json.dump({
    "network": network,
    "chainIdentifier": chain,
    "packageId": package,
    "publishedAtDigest": digest,
    "deployer": deployer,
    "publishedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    # Demonstration vaults survive a republish; they are keyed to the old package only in that
    # their proposals were opened against it, and they keep working.
    "vaults": existing.get("vaults", []),
}, open(out, "w"), indent=2)
print(f"wrote {out}")
PY

echo
echo "package:    $PACKAGE_ID"
echo "record:     $HERE/Published.toml  (commit this)"
echo "explorer:   https://suiscan.xyz/$NETWORK/object/$PACKAGE_ID"
echo
echo "next:"
echo "  cd ../app && npm run sync-deployments"
echo "  cd ../sdk && SUI_PRIVATE_KEY=... SKUR_NETWORK=$NETWORK SKUR_PACKAGE_ID=$PACKAGE_ID npm run e2e"
