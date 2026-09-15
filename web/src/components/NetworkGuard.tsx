import { useAccount, useSwitchChain } from "wagmi";
import { arkDevnet } from "../config/chain";
import { Button } from "./ui";

/** Shows a switch button while the connected wallet is on a chain other than the Ark devnet. */
export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  if (!isConnected || chainId === arkDevnet.id) return null;
  return (
    <Button size="sm" kind="danger" disabled={isPending} onClick={() => switchChain({ chainId: arkDevnet.id })} title={`Your wallet is on chain ${chainId}; Skur runs on chain ${arkDevnet.id}`}>
      Switch to Ark devnet
    </Button>
  );
}
