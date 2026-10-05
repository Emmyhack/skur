# Skur on iOS and Android

Expo and React Native, reading the chain through `@mysten/sui` over gRPC and sharing the vault
logic with every other interface via [`@skur/sdk`](../sdk).

## The key on the device

This is the part to understand before using it.

The app generates an Ed25519 key and writes it to the **iOS keychain or Android keystore**, not to
app storage. `requireAuthentication` means the OS will not release it without a successful
biometric or passcode check, and the key is unlocked **per transaction** — there is no session.
A cached signer is a signer that acts without a face, which on a treasury app is the thing you
were trying to avoid.

What that does **not** give you:

- **No protection on a rooted or jailbroken device.** The keystore's guarantees end there.
- **No backup.** Lose the phone and the key is gone — which is what the vault's guardian recovery
  is for: guardians move your roles to a new key after a delay any owner can cancel.

**A key on a phone is a hot key.** It is appropriate for an **approver** or an **executor**, whose
authority is bounded by the vault's policy — tiers, caps, the day's allowance, the loss envelope.
It is **not** appropriate for a **guardian**. A guardian's entire value is being an independent
control plane an attacker has to breach separately; keeping a guardian key on the same phone as an
approver key collapses the two planes the contract works to keep apart. The app says so where it
matters, and the contract will refuse to give one address both roles anyway.

## Running it

```bash
npm install
cp .env.example .env     # point it at a network and a published package
npm start                # Metro, for Expo Go or a dev build
npm run ios              # prebuild, pods and a simulator run
npm run android
npm run typecheck
```

Every script builds [`../sdk`](../sdk) first, because the app consumes its compiled output and a
fresh clone would otherwise fail with an unhelpful resolver error.

| Variable | What it does |
|---|---|
| `EXPO_PUBLIC_SKUR_NETWORK` | `mainnet`, `testnet`, `devnet` or `localnet` |
| `EXPO_PUBLIC_SKUR_PACKAGE_ID` | The published package |
| `EXPO_PUBLIC_SKUR_GRPC_URL` | A full node other than the public one |
| `EXPO_PUBLIC_SKUR_API` | The indexer. Optional — see below |

`app.json`'s `extra` holds the committed defaults; `EXPO_PUBLIC_*` overrides them.

## What needed solving for React Native

Three things, all in [`src/lib/polyfills.ts`](src/lib/polyfills.ts) and
[`metro.config.js`](metro.config.js):

- **Hermes has no CSPRNG behind `crypto.getRandomValues`**, which key generation needs.
  `react-native-get-random-values` supplies it, and `assertCryptoReady` fails at startup rather
  than mid-signature if it did not load.
- **The text codecs BCS needs** ship with recent React Native, but a silent absence would surface
  much later as a corrupted transaction rather than a missing global, so there is a guarded UTF-8
  fallback.
- **The Sui SDK is ESM with an exports map and no CommonJS fallback**, and `@skur/sdk` resolves
  through a symlink to a sibling directory. Metro needs `unstable_enablePackageExports`, `mjs` in
  `sourceExts`, and the workspace in `watchFolders`.
- **`Intl.PluralRules` does not exist in Hermes**, and the Sui SDK builds an ordinal formatter with
  it at **module scope** — `new Intl.PluralRules("en-US", { type: "ordinal" })`, used to say "1st
  command" in an error message. On Hermes the constructor is `undefined`, so importing anything
  from the SDK's client throws `undefined cannot be used as a constructor` before a line of app
  code runs, with no usable stack. An English-ordinals polyfill fixes it, and `assertCryptoReady`
  checks it at startup.

Transport is **gRPC-web over fetch**, which is what React Native can actually do — there is no
HTTP/2 socket to reach for. JSON-RPC is not used anywhere: Sui switched it off on mainnet full
nodes in July 2026 and is removing it.

## The indexer is optional

Every screen reads the chain directly through the SDK. Setting `EXPO_PUBLIC_SKUR_API` adds one
thing — finding your vaults by address, since a vault does not know it is yours — and saves round
trips. Without it you open a vault by its id and everything else works.

## Screens

| Screen | What it does |
|---|---|
| Welcome, Set up signing | The pitch, then creating or importing the device key |
| Treasury | Posture, holdings, today's outflow per asset, what the policy enforces |
| Activity | The queue and the history, with one proposal per row |
| Proposal | Approve, reject, confirm, veto or execute — each gated on the role the contract requires |
| Pay | Open a payment, with the vault's own `preview_transfer` as the review |
| Receive | The vault address, and which assets it accepts |
| Security | The posture report, the maximum-loss numbers, and freezing the vault |
| Settings | Appearance, the device key, the network, closing the vault |

Every action is gated on the role the device's key actually holds, so a signer is never offered
something the vault would refuse. The payment review is the chain's classification, simulated
live — the phone does not compute a tier, because an interface that computed its own answer could
promise something the vault would reject, and on a confirmation screen that is the one thing that
must never happen.
