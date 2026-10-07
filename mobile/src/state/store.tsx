import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { hasSigner, signerAddress } from '../lib/keystore';

/**
 * What the app remembers between launches: which vault is open, the addresses you have labelled,
 * and whether onboarding is done. None of it is authoritative — the vault is, and all of this is
 * rebuilt from the chain on open.
 */
export type Labelled = { address: string; label: string };

/** Who is holding the phone, for the Settings header and notification registrations. Local only. */
export type Profile = { name: string; email: string };

type Store = {
  ready: boolean;
  /** Null until a key exists on the device. */
  address: string | null;
  vaultId: string | null;
  onboarded: boolean;
  book: Labelled[];
  profile: Profile | null;
  saveProfile: (p: Profile) => void;
  openVault: (id: string) => void;
  closeVault: () => void;
  finishOnboarding: () => void;
  label: (address: string, label: string) => void;
  unlabel: (address: string) => void;
  /** Re-read the device key, after creating, importing or forgetting one. */
  refreshSigner: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const K = {
  vault: 'skur.vault',
  onboarded: 'skur.onboarded',
  book: 'skur.book',
  profile: 'skur.profile',
} as const;

/**
 * A normalised Sui object id: 0x and exactly 32 bytes of hex. Storage is validated on load
 * because this app's storage keys are older than its chain — an earlier build wrote an EVM
 * address (40 hex chars) under the same key, and restoring it silently points every screen at a
 * vault that cannot exist.
 */
const SUI_ID = /^0x[0-9a-fA-F]{64}$/;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [book, setBook] = useState<Labelled[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshSigner = useCallback(async () => {
    setAddress((await hasSigner()) ? await signerAddress() : null);
  }, []);

  useEffect(() => {
    void (async () => {
      const [v, o, b, pr] = await Promise.all([
        AsyncStorage.getItem(K.vault),
        AsyncStorage.getItem(K.onboarded),
        AsyncStorage.getItem(K.book),
        AsyncStorage.getItem(K.profile),
      ]);
      try {
        if (pr) {
          const parsed = JSON.parse(pr) as Profile;
          if (parsed && typeof parsed.name === 'string' && typeof parsed.email === 'string') {
            setProfile(parsed);
          }
        }
      } catch {
        // A corrupted profile is cosmetic; the key and the vault are what matter.
      }
      if (v && SUI_ID.test(v)) {
        setVaultId(v);
      } else if (v) {
        // Residue from before, or hand-edited: drop it rather than show a vault that can't load.
        void AsyncStorage.removeItem(K.vault);
      }
      setOnboarded(o === '1');
      try {
        setBook(b ? (JSON.parse(b) as Labelled[]) : []);
      } catch {
        // A corrupted address book is an inconvenience, not a reason to fail to start.
        setBook([]);
      }
      await refreshSigner();
      setReady(true);
    })();
  }, [refreshSigner]);

  const openVault = useCallback((id: string) => {
    setVaultId(id);
    void AsyncStorage.setItem(K.vault, id);
  }, []);

  const closeVault = useCallback(() => {
    setVaultId(null);
    void AsyncStorage.removeItem(K.vault);
  }, []);

  const saveProfile = useCallback((p: Profile) => {
    setProfile(p);
    void AsyncStorage.setItem(K.profile, JSON.stringify(p));
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboarded(true);
    void AsyncStorage.setItem(K.onboarded, '1');
  }, []);

  const persistBook = useCallback((next: Labelled[]) => {
    setBook(next);
    void AsyncStorage.setItem(K.book, JSON.stringify(next));
  }, []);

  const label = useCallback(
    (addr: string, text: string) =>
      persistBook([
        ...book.filter((e) => e.address !== addr),
        { address: addr, label: text },
      ]),
    [book, persistBook],
  );

  const unlabel = useCallback(
    (addr: string) => persistBook(book.filter((e) => e.address !== addr)),
    [book, persistBook],
  );

  const value = useMemo(
    () => ({
      ready,
      address,
      vaultId,
      onboarded,
      book,
      profile,
      saveProfile,
      openVault,
      closeVault,
      finishOnboarding,
      label,
      unlabel,
      refreshSigner,
    }),
    [ready, address, vaultId, onboarded, book, profile, saveProfile, openVault, closeVault, finishOnboarding, label, unlabel, refreshSigner],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
