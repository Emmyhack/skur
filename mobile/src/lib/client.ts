import { createPublicClient, http } from "viem";
import { arkDevnet, ARK_DEVNET_RPC } from "@web/config/chain";

/** One public client for the app. No JSON-RPC batching: the devnet serves batches serially (docs/DECISIONS.md D18). */
export const publicClient = createPublicClient({ chain: arkDevnet, transport: http(ARK_DEVNET_RPC, { retryCount: 2 }) });
