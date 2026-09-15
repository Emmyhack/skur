# Skur

Programmable treasury security for onchain businesses. Protect funds with adaptive policies, loss limits, guardians, and risk-aware approvals.

> A valid signature proves authorization. It does not prove that a transaction is safe.

Skur is a self-custodial vault whose security requirements change with transaction risk. Valid approvals are necessary but never sufficient: amount tiers, treasury exposure, recipient trust, cumulative outflow, guardian veto and security modes are all enforced by the vault contract itself. No Skur server sits in the execution path.

## Repository layout

| Path | What it is |
|---|---|
| [contracts/](contracts/) | Foundry project: `SkurVault`, `SkurFactory`, `SkurPolicyLib`, `SkurRisk`, the devnet stablecoin, tests, invariants and deploy script |
| [web/](web/) | Client-side interface (Vite, React, wagmi/viem). Reads contract state and events directly; submits user-signed transactions |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every open question from the blueprint, resolved |
| [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) | Roles, lifecycle, the twelve invariants and the tests that prove each |
| [docs/scriipture-capability-report.md](docs/scriipture-capability-report.md) | Why the contracts are plain Solidity instead of Scriipture TypeScript |
| [scripts/export-abi.py](scripts/export-abi.py) | Copies ABIs from the Foundry build into the web app |

## Ark Constellation devnet deployment

Chain id 9000, native token KASH. Sources are verified on the Blockscout explorer.

| Contract | Address |
|---|---|
| SkurFactory | [`0x02929b28DD9DDf57b1615c70DCCdca6b6EDA0015`](https://explorer.34.60.137.196.sslip.io/address/0x02929b28DD9DDf57b1615c70DCCdca6b6EDA0015) |
| SkurVault implementation | [`0xFd5202675c194FBFA682622F11b80167336abba5`](https://explorer.34.60.137.196.sslip.io/address/0xFd5202675c194FBFA682622F11b80167336abba5) |
| SkurPolicyLib | [`0x689a4b4Bb095cc9F2F9535Eaf6D71E6DD0B55837`](https://explorer.34.60.137.196.sslip.io/address/0x689a4b4Bb095cc9F2F9535Eaf6D71E6DD0B55837) |
| SkurTestUSD (sUSD, 6 decimals, mintable) | [`0xF4AbedF17C3C8669D13C352a6002eAe5B39D772B`](https://explorer.34.60.137.196.sslip.io/address/0xF4AbedF17C3C8669D13C352a6002eAe5B39D772B) |
| Demo vault (Startup template) | [`0xb2208Ad86B44cE75427334A117Ae27CB1b8bc4cC`](https://explorer.34.60.137.196.sslip.io/address/0xb2208Ad86B44cE75427334A117Ae27CB1b8bc4cC) |

The full record, including the deployer address, is in [contracts/deployments/9000.json](contracts/deployments/9000.json). Endpoints live only in `contracts/foundry.toml` and `web/src/config/chain.ts`.

## Quick start

Dependencies are git submodules, so clone with `--recurse-submodules` (or run
`git submodule update --init --recursive` in an existing clone).

```bash
# contracts
cd contracts
forge build
forge test                     # unit, fuzz and invariant suites
slither . --filter-paths "lib/|test/|script/"

# interface
cd ../web
npm install
npm run dev                    # http://localhost:5173, connect MetaMask on chain 9000
npm test                       # risk-engine mirror vectors
```

Get devnet KASH from the faucet at `https://faucet.34.60.137.196.sslip.io/` and mint sUSD by calling `mint(address,uint256)` on the test token.

## Deploying your own instance

```bash
cd contracts
cp .env.example .env           # set PRIVATE_KEY (devnet only) and DEMO_VAULT
forge script script/Deploy.s.sol --rpc-url ark_devnet --broadcast --private-key $PRIVATE_KEY
forge verify-contract <address> src/SkurVault.sol:SkurVault --verifier blockscout \
  --verifier-url https://explorer-api.34.60.137.196.sslip.io/api --chain 9000 \
  --libraries src/SkurPolicyLib.sol:SkurPolicyLib:<lib address>
python3 ../scripts/export-abi.py && cp deployments/9000.json ../web/src/config/deployments.json
```

For a keyless deploy, `npx scriipture deploy` can broadcast the compiled artifact through a browser wallet.

## How the vault decides

1. A proposal is created. The vault classifies it LOW, HIGH or CRITICAL from amount, share of holdings, recipient trust, today's outflow and the security mode, and pins the required approvals, guardian confirmations and delay.
2. Approvers approve. Guardians confirm when the tier demands it. A guardian can veto any critical, probationary or security-reducing proposal at any time.
3. An executor executes. The vault re-checks every limit at that moment: recipient not blocked and past activation, per-transaction cap, hard exposure block, daily bucket, and the loss envelope. Exceeding the envelope trips the vault into Lockdown instead of paying.
4. Governance changes follow the same path with owner approvals. Anything that loosens security waits for the policy-change delay, is vetoable, and is refused while in Lockdown.

Guardians can freeze, veto, confirm and recover. They hold no treasury role and can never move funds.

## Status

V1 as scoped in the blueprint: vault creation, protected membership, four roles, native and ERC-20 deposits and transfer proposals, amount tiers, recipient trust with activation delay, per-transaction and 24-hour caps, circuit breaker, critical timelock and veto, three security modes, policy-change timelock, recovery, human-readable review, policy templates, policy simulator, maximum-loss view and posture indicator. Not yet done: independent audit and pilot.
