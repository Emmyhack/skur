import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type Signer = { key: `0x${string}`; address: `0x${string}` };
type Store = {
  ready: boolean;
  vaultAddress: `0x${string}` | null;
  setVaultAddress: (a: `0x${string}` | null) => Promise<void>;
  labels: Record<string, string>;
  setLabel: (vault: `0x${string}`, name: string) => Promise<void>;
  signer: Signer | null;
  createSigner: () => Promise<Signer>;
  importSigner: (key: string) => Promise<Signer>;
  removeSigner: () => Promise<void>;
  biometrics: boolean;
  setBiometrics: (on: boolean) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const K = { vault: "skur.vault", labels: "skur.labels", bio: "skur.biometrics", signer: "skur.signer" };

/** App state. The signer's private key lives only in the device keychain (expo-secure-store); nothing leaves the phone but signed transactions. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [vaultAddress, setVault] = useState<`0x${string}` | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [signer, setSigner] = useState<Signer | null>(null);
  const [biometrics, setBio] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [v, l, b, key] = await Promise.all([AsyncStorage.getItem(K.vault), AsyncStorage.getItem(K.labels), AsyncStorage.getItem(K.bio), SecureStore.getItemAsync(K.signer)]);
        if (v) setVault(v as `0x${string}`);
        if (l) setLabels(JSON.parse(l));
        if (b !== null) setBio(b === "1");
        if (key) setSigner({ key: key as `0x${string}`, address: privateKeyToAccount(key as `0x${string}`).address });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setVaultAddress = useCallback(async (a: `0x${string}` | null) => { setVault(a); if (a) await AsyncStorage.setItem(K.vault, a); else await AsyncStorage.removeItem(K.vault); }, []);
  const setLabel = useCallback(async (vault: `0x${string}`, name: string) => { setLabels((l) => { const n = { ...l, [vault.toLowerCase()]: name }; void AsyncStorage.setItem(K.labels, JSON.stringify(n)); return n; }); }, []);
  const persistSigner = useCallback(async (key: `0x${string}`) => { const s = { key, address: privateKeyToAccount(key).address }; await SecureStore.setItemAsync(K.signer, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); setSigner(s); return s; }, []);
  const createSigner = useCallback(() => persistSigner(generatePrivateKey()), [persistSigner]);
  const importSigner = useCallback((raw: string) => { const k = (raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`) as `0x${string}`; if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error("A private key is 64 hex characters."); return persistSigner(k); }, [persistSigner]);
  const removeSigner = useCallback(async () => { await SecureStore.deleteItemAsync(K.signer); setSigner(null); }, []);
  const setBiometrics = useCallback(async (on: boolean) => { setBio(on); await AsyncStorage.setItem(K.bio, on ? "1" : "0"); }, []);

  const value = useMemo<Store>(() => ({ ready, vaultAddress, setVaultAddress, labels, setLabel, signer, createSigner, importSigner, removeSigner, biometrics, setBiometrics }), [ready, vaultAddress, setVaultAddress, labels, setLabel, signer, createSigner, importSigner, removeSigner, biometrics, setBiometrics]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
