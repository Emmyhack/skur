import { defineChain } from "viem";
import deployments from "./deployments.json";

/**
 * The single place the Ark Constellation endpoints live in the interface.
 * The sslip.io hosts are devnet-only and move to an Ark-owned domain for testnet/mainnet.
 * The other copy is contracts/foundry.toml.
 */
export const ARK_DEVNET_RPC = "https://evm.34.60.137.196.sslip.io";
export const ARK_DEVNET_WS = "wss://evm-ws.34.60.137.196.sslip.io";
export const ARK_DEVNET_EXPLORER = "https://explorer.34.60.137.196.sslip.io";
export const ARK_DEVNET_FAUCET = "https://faucet.34.60.137.196.sslip.io/";

export const arkDevnet = defineChain({
  id: 9000,
  name: "Ark Constellation Devnet",
  nativeCurrency: { name: "KASH", symbol: "KASH", decimals: 18 },
  rpcUrls: {
    default: { http: [ARK_DEVNET_RPC], webSocket: [ARK_DEVNET_WS] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: ARK_DEVNET_EXPLORER },
  },
  testnet: true,
});

export type Deployments = {
  chainId: number;
  testUsd: `0x${string}`;
  factory: `0x${string}`;
  vaultImplementation: `0x${string}`;
  demoVault: `0x${string}`;
  deployer: `0x${string}`;
  deployedAtBlock: number;
};

export const DEPLOYMENTS = deployments as Deployments;

export const NATIVE_ASSET = "0x0000000000000000000000000000000000000000" as const;

export function explorerAddress(addr: string): string {
  return `${ARK_DEVNET_EXPLORER}/address/${addr}`;
}

export function explorerTx(hash: string): string {
  return `${ARK_DEVNET_EXPLORER}/tx/${hash}`;
}
