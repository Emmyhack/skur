# Skur mobile

The phone companion to the Skur web interface, built after Safe{Mobile}'s structure in Skur's own pattern: a splash with the logo, a three-page onboarding carousel, a Home with the vault switcher, chain row, big balance and Tokens, Policy and Members tabs, Transactions grouped by date, a Confirm-transaction screen with a sticky sign bar, Send with the vault's own review, Security, and Settings as grouped rows. Charcoal ground, #FFD000 as hazard tape and highlighter, Space Grotesk for display, the same identicons as the web. Built with Expo and React Native for iOS and Android.

## Screens

Onboarding carousel and splash, Home (vault switcher sheet, balance, Tokens/Policy/Members tabs), Transactions (queue, history, type filter), Confirm transaction, Send, Receive, Security (posture, mode, guardians, recovery, maximum loss, mode history), Policy editor (templates, every control, per-asset limits), Members (roles, thresholds), Address book (register, trust), Simulator (attack scenarios), Updates (what needs you, recent activity, notification switch), Signers (several keys on one phone), Create vault, and a QR scanner for vault and recipient addresses.

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

Deep links: `skur://vault/<address>`, `skur://tx/<id>`, and one per screen (`home`, `transactions`, `settings`, `send`, `receive`, `security`, `addressbook`, `members`, `policy`, `simulator`, `create`, `signers`, `updates`, `scan`). Notifications carry the transaction link.

## Notifications

Local, not push. While the app reads the vault it raises a notification for any proposal that newly needs the active signer, and the Updates screen lists those alongside recent activity. Nothing is sent to a server.

## Building natively

`npx expo run:ios` needs CocoaPods and `cmake` on PATH (hermes builds from source). This project sets `ios.usePrecompiledModules: false` in `app.json`: the precompiled Expo module frameworks link against a prebuilt `React.framework` that is not always fetchable, and mixing the two crashes the app at launch with `Library not loaded: @rpath/React.framework/React`.
