import { useCallback, useEffect, useState } from "react";

const KEY = "skur.vaultLabels";

function readAll(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** A private, browser-local display name for a vault. Never leaves the device; the chain only knows the address. */
export function useVaultLabel(address: string | null): [string, (label: string) => void] {
  const [labels, setLabels] = useState<Record<string, string>>(readAll);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(labels));
    } catch {
      /* ignore */
    }
  }, [labels]);
  const key = address?.toLowerCase() ?? "";
  const set = useCallback((label: string) => setLabels((l) => ({ ...l, [key]: label })), [key]);
  return [labels[key] ?? "Treasury vault", set];
}
