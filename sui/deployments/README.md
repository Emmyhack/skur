# Deployments

One file per network, written by [`../scripts/publish.sh`](../scripts/publish.sh). This is the only
place a package address is configured: the SDK, the interface and the backend all read it from here
or from an environment variable that overrides it.

```json
{
  "network": "testnet",
  "packageId": "0x…",
  "publishedAtDigest": "…",
  "deployer": "0x…",
  "publishedAt": "2026-10-05T00:00:00Z",
  "vaults": [{ "id": "0x…", "name": "Skur Demo Treasury" }]
}
```

`vaults` is for demonstration vaults worth linking to from the docs. It is not a registry: a vault
is a shared object and works whether or not it is listed here.

Run `npm run sync-deployments` in [`../../app`](../../app) after publishing, to copy these into the
interface's bundle.
