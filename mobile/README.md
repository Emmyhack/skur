# Skur mobile

The phone companion to the Skur web interface: open a vault, read its balances, queue, policy and security posture, and confirm, execute, veto or propose from the phone. Built with Expo and React Native for iOS and Android.

## What it shares with the web app

Everything that decides something is imported from `web/src` through the `@web/*` alias configured in `metro.config.js` and `tsconfig.json`: the contract ABI, chain configuration, types, the risk engine, policy rules, the max-loss and posture calculators, the contract reads (`lib/vaultReads.ts`) and the error texts. The mobile code holds only screens, navigation, storage and signing.

## Signing

There is no wallet connection. A signer key is created on the phone or imported, stored in the device keychain through `expo-secure-store`, and used to sign after a Face ID or Touch ID prompt (`expo-local-authentication`, switchable in Settings). Add that address as a member of a vault to act for it; without a role the app is read-only. Every write is simulated against the vault first, so a policy refusal reads as plain language before anything is signed.

## Run it

```sh
cd mobile
npm install
npx expo start          # then press i for the iOS simulator or a for Android, or scan with Expo Go
npx tsc --noEmit        # type-check, including the shared web modules
```

The app reads the Ark Constellation devnet (chain 9000) through the endpoints in `web/src/config/chain.ts`. It ships no key and no backend.
