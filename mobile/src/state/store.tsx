import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type Signer = { key: `0x${string}`; address: `0x${string}`; label: string };
type Store = {
  ready: boolean;
  vaultAddress: `0x${string}` | null;
  setVaultAddress: (a: `0x${string}` | null) => Promise<void>;
  labels: Record<string, string>;
  setLabel: (vault: `0x${string}`, name: string) => Promise<void>;
  /** The active signer, or null when the phone holds no key. */
  signer: Signer | null;
  signers: Signer[];
  createSigner: (label?: string) => Promise<Signer>;
  importSigner: (key: string, label?: string) => Promise<Signer>;
  removeSigner: (address?: `0x${string}`) => Promise<void>;
  setActiveSigner: (address: `0x${string}`) => Promise<void>;
  renameSigner: (address: `0x${string}`, label: string) => Promise<void>;
  biometrics: boolean;
  setBiometrics: (on: boolean) => Promise<void>;
  onboarded: boolean;
  setOnboarded: (v?: boolean) => Promise<void>;
  notifications: boolean;
  setNotifications: (on: boolean) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const K = { vault: "skur.vault", labels: "skur.labels", bio: "skur.biometrics", signer: "skur.signer", signers: "skur.signers", active: "skur.activeSigner", onboarded: "skur.onboarded", notif: "skur.notifications" };

const toSigner = (key: `0x${string}`, label: string): Signer => ({ key, address: privateKeyToAccount(key).address, label });

/** App state. Signer keys live only in the device keychain (expo-secure-store); nothing leaves the phone but signed transactions. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [vaultAddress, setVault] = useState<`0x${string}` | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [signers, setSigners] = useState<Signer[]>([]);
  const [active, setActive] = useState<`0x${string}` | null>(null);
  const [biometrics, setBio] = useState(true);
  const [onboarded, setOnb] = useState(false);
  const [notifications, setNotif] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [v, l, b, legacy, list, act, o, n] = await Promise.all([AsyncStorage.getItem(K.vault), AsyncStorage.getItem(K.labels), AsyncStorage.getItem(K.bio), SecureStore.getItemAsync(K.signer), SecureStore.getItemAsync(K.signers), AsyncStorage.getItem(K.active), AsyncStorage.getItem(K.onboarded), AsyncStorage.getItem(K.notif)]);
        if (v) setVault(v as `0x${string}`);
        if (l) setLabels(JSON.parse(l));
        if (b !== null) setBio(b === "1");
        if (o === "1") setOnb(true);
        if (n !== null) setNotif(n === "1");
        let arr: Array<{ key: `0x${string}`; label: string }> = list ? JSON.parse(list) : [];
        if (legacy && !arr.some((x) => x.key === legacy)) { arr = [{ key: legacy as `0x${string}`, label: "Device signer" }, ...arr]; await SecureStore.setItemAsync(K.signers, JSON.stringify(arr)); await SecureStore.deleteItemAsync(K.signer); }
        const ss = arr.map((x) => toSigner(x.key, x.label));
        setSigners(ss);
        setActive((act as `0x${string}`) && ss.some((s) => s.address === act) ? (act as `0x${string}`) : ss[0]?.address ?? null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (ss: Signer[]) => { setSigners(ss); await SecureStore.setItemAsync(K.signers, JSON.stringify(ss.map((s) => ({ key: s.key, label: s.label })))); }, []);
  const setVaultAddress = useCallback(async (a: `0x${string}` | null) => { setVault(a); if (a) await AsyncStorage.setItem(K.vault, a); else await AsyncStorage.removeItem(K.vault); }, []);
  const setLabel = useCallback(async (vault: `0x${string}`, name: string) => { setLabels((l) => { const n = { ...l, [vault.toLowerCase()]: name }; void AsyncStorage.setItem(K.labels, JSON.stringify(n)); return n; }); }, []);
  const addSigner = useCallback(async (key: `0x${string}`, label: string) => {
    const s = toSigner(key, label);
    const next = signers.some((x) => x.address === s.address) ? signers : [...signers, s];
    await persist(next);
    setActive(s.address); await AsyncStorage.setItem(K.active, s.address);
    return s;
  }, [signers, persist]);
  const createSigner = useCallback((label?: string) => addSigner(generatePrivateKey(), label ?? `Signer ${signers.length + 1}`), [addSigner, signers.length]);
  const importSigner = useCallback((raw: string, label?: string) => { const k = (raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`) as `0x${string}`; if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error("A private key is 64 hex characters."); return addSigner(k, label ?? `Signer ${signers.length + 1}`); }, [addSigner, signers.length]);
  const removeSigner = useCallback(async (address?: `0x${string}`) => { const target = address ?? active; const next = signers.filter((s) => s.address !== target); await persist(next); const a = next[0]?.address ?? null; setActive(a); if (a) await AsyncStorage.setItem(K.active, a); else await AsyncStorage.removeItem(K.active); }, [signers, active, persist]);
  const setActiveSigner = useCallback(async (address: `0x${string}`) => { setActive(address); await AsyncStorage.setItem(K.active, address); }, []);
  const renameSigner = useCallback(async (address: `0x${string}`, label: string) => { await persist(signers.map((s) => (s.address === address ? { ...s, label } : s))); }, [signers, persist]);
  const setBiometrics = useCallback(async (on: boolean) => { setBio(on); await AsyncStorage.setItem(K.bio, on ? "1" : "0"); }, []);
  const setOnboarded = useCallback(async (v = true) => { setOnb(v); await AsyncStorage.setItem(K.onboarded, v ? "1" : "0"); }, []);
  const setNotifications = useCallback(async (on: boolean) => { setNotif(on); await AsyncStorage.setItem(K.notif, on ? "1" : "0"); }, []);

  const signer = useMemo(() => signers.find((s) => s.address === active) ?? null, [signers, active]);
  const value = useMemo<Store>(() => ({ ready, vaultAddress, setVaultAddress, labels, setLabel, signer, signers, createSigner, importSigner, removeSigner, setActiveSigner, renameSigner, biometrics, setBiometrics, onboarded, setOnboarded, notifications, setNotifications }),
    [ready, vaultAddress, setVaultAddress, labels, setLabel, signer, signers, createSigner, importSigner, removeSigner, setActiveSigner, renameSigner, biometrics, setBiometrics, onboarded, setOnboarded, notifications, setNotifications]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
