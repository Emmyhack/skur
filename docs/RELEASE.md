# Releasing the mobile apps

The phones build through [EAS](https://docs.expo.dev/build/introduction/). Everything the build
needs is in the repo except two things that are account-bound and deliberately not committed: the
EAS project id and the store credentials.

## One-time setup

```bash
cd mobile
npx eas login                 # the Expo account that owns the app
npx eas init                  # writes extra.eas.projectId into app.json — commit that change
```

`extra.eas.projectId` is also what remote push notifications key on: without it,
`getExpoPushTokenAsync` refuses and Settings says so. Setting it once fixes builds and push
together.

Credentials (Apple certificates, Android keystore) are created and stored by EAS on first build —
answer the prompts, let it manage them.

## Profiles

Defined in [mobile/eas.json](../mobile/eas.json):

| Profile | For | Notes |
|---|---|---|
| `development` | day-to-day work | dev client; pair with `npx expo start` |
| `preview` | hand-installable test builds | internal distribution, no store |
| `production` | the stores | `autoIncrement` bumps build numbers remotely |

Every profile pins `EXPO_PUBLIC_SKUR_NETWORK`. Before a production build, also set the published
package id and the deployed indexer URL for that network:

```bash
# in mobile/eas.json, production.env:
"EXPO_PUBLIC_SKUR_PACKAGE_ID": "0x…",
"EXPO_PUBLIC_SKUR_API": "https://api.your-deployment…"
```

(Dev builds read `.env` instead, which is gitignored.)

## Building

```bash
cd mobile
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
# or both: --platform all
```

Store submission, once builds exist:

```bash
npx eas submit --platform ios
npx eas submit --platform android
```

## Versioning

- `expo.version` in `app.json` is the human version (1.0.0) — bump it per release, in git.
- iOS `buildNumber` / Android `versionCode` are managed remotely (`appVersionSource: "remote"` +
  `autoIncrement`): every production build gets the next number without a commit.

## What release builds change

- No expo-dev-launcher: cold `skur://` deep links go straight to the app (the dev-only
  launcher crash documented in the memory notes does not exist in release).
- `EXPO_PUBLIC_*` come from the profile, not `.env`.
- The splash, icons and the brand mark are already production assets — nothing to swap.

## Before shipping, every time

```bash
npm run verify      # from the repo root: Move tests, SDK, server, web, mobile — 11 gates
```

And the standing honesty check: Skur has **no independent audit**. The store listing and the app
itself say so; keep it that way until it stops being true.
