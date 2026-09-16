import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { DARK, LIGHT, type Palette } from "../theme";

export type Scheme = "light" | "dark" | "system";
const Ctx = createContext<{ C: Palette; scheme: Scheme; dark: boolean; setScheme: (s: Scheme) => void } | null>(null);
const KEY = "skur.theme";

/** One ground for the whole app, onboarding included, switchable in Settings and remembered. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [scheme, setSchemeState] = useState<Scheme>("system");
  useEffect(() => { void AsyncStorage.getItem(KEY).then((v) => { if (v === "light" || v === "dark" || v === "system") setSchemeState(v); }); }, []);
  const setScheme = useCallback((s: Scheme) => { setSchemeState(s); void AsyncStorage.setItem(KEY, s); }, []);
  const dark = scheme === "system" ? system === "dark" : scheme === "dark";
  const value = useMemo(() => ({ C: dark ? DARK : LIGHT, scheme, dark, setScheme }), [dark, scheme, setScheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): Palette {
  const t = useContext(Ctx);
  if (!t) throw new Error("ThemeProvider missing");
  return t.C;
}

export function useScheme() {
  const t = useContext(Ctx);
  if (!t) throw new Error("ThemeProvider missing");
  return t;
}
