import { useCallback, useEffect, useState } from "react";
import { isAddress } from "viem";
import { DEPLOYMENTS } from "../config/chain";

const KEY = "skur.vault";

function readInitial(): `0x${string}` | null {
  try {
    const fromHash = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("vault");
    if (fromHash && isAddress(fromHash)) return fromHash as `0x${string}`;
    const stored = window.localStorage.getItem(KEY);
    if (stored && isAddress(stored)) return stored as `0x${string}`;
  } catch {
    /* storage unavailable */
  }
  if (DEPLOYMENTS.demoVault && DEPLOYMENTS.demoVault !== "0x0000000000000000000000000000000000000000") {
    return DEPLOYMENTS.demoVault;
  }
  return null;
}

/** The selected vault. Persisted per browser; the contracts are the source of truth for everything else. */
export function useVaultAddress(): [`0x${string}` | null, (a: `0x${string}` | null) => void] {
  const [addr, setAddr] = useState<`0x${string}` | null>(readInitial);
  useEffect(() => {
    try {
      if (addr) window.localStorage.setItem(KEY, addr);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, [addr]);
  const set = useCallback((a: `0x${string}` | null) => setAddr(a), []);
  return [addr, set];
}
