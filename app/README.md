# The Skur interface

Next.js, React and `@mysten/dapp-kit-react` over gRPC.

## Two route groups, two design languages

| Group | Routes | Rendering |
|---|---|---|
| `(marketing)` | `/`, `/product`, `/solutions`, `/security`, `/docs`, `/docs/[slug]` | Static. No wallet, no chain reads at build time |
| `(dapp)` | `/app`, `/vault/[id]` | Client-only (`ssr: false`), because wallet detection needs a browser |

Each group imports its own stylesheet from its layout, so the marketing design and the vault
interface never have to fight each other's base rules. The root layout carries no CSS.

## Why dapp-kit 2.x

`@mysten/dapp-kit` 1.x is deprecated because it speaks only JSON-RPC, which Sui switched off on
mainnet full nodes in July 2026 and is removing entirely in mid-October 2026. This app uses
`@mysten/dapp-kit-react` 2.x with a `SuiGrpcClient`. Nothing here depends on JSON-RPC, directly or
transitively.

## Configuration

```bash
cp .env.example .env
```

| Variable | What it does |
|---|---|
| `NEXT_PUBLIC_SKUR_NETWORK` | Which Sui network. Defaults to `testnet` |
| `NEXT_PUBLIC_SKUR_PACKAGE_ID` | The published package. Overrides the committed deployment |
| `NEXT_PUBLIC_SKUR_GRPC_URL` | A full node other than the public one |
| `NEXT_PUBLIC_SKUR_API` | The indexer. Optional — see below |

Published addresses live in `sui/deployments/<network>.json`. `npm run sync-deployments` copies them
into `src/config/deployments.json` so the app does not import across the workspace boundary.

## The indexer is optional, on purpose

Every screen works without `NEXT_PUBLIC_SKUR_API`. The vault, its policy, its roster, its
recipients and its proposals are all read from the chain through the SDK. The indexer saves round
trips and powers two conveniences — finding your vaults by address, and the recipient advisory — and
switching it off costs you those, not the ability to read the vault or move money.

That is the test every endpoint had to pass: if this service disappears, what breaks must be speed,
not control.

## The preview is the vault's

The confirmation screen does not compute a tier. It simulates the vault's own `preview_transfer`,
which is the same Move function `execute_transfer` runs. An interface that computed its own answer
could promise something the vault would refuse, and on a confirmation screen that is the one thing
that must never happen.

The TypeScript risk engine in the SDK is used only where there is no vault to ask: the policy
editor and the simulator, which run against a policy that is not deployed yet.

## Running it

```bash
npm install
npm run sync-deployments   # after publishing the Move package
npm run dev                # http://localhost:3000
npm run typecheck
```
