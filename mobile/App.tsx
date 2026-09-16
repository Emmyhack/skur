import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNavigationContainerRef, DarkTheme, NavigationContainer, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { isAddress } from "viem";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Status } from "@web/lib/types";
import { Button, Notice, Screen, TopBar } from "./src/components/ui";
import { useVault } from "./src/hooks/useVault";
import { Home } from "./src/screens/Home";
import { Onboard } from "./src/screens/Onboard";
import { Welcome } from "./src/screens/Welcome";
import { AddressBook } from "./src/screens/AddressBook";
import { Members } from "./src/screens/Members";
import { Policy } from "./src/screens/Policy";
import { Simulator } from "./src/screens/Simulator";
import { CreateVault } from "./src/screens/CreateVault";
import { Signers } from "./src/screens/Signers";
import { NotificationsScreen } from "./src/screens/Notifications";
import { Scan } from "./src/screens/Scan";
import { useAlerts } from "./src/hooks/useAlerts";
import { Logo } from "./src/components/ui";
import { Receive } from "./src/screens/Receive";
import { Security } from "./src/screens/Security";
import { Send } from "./src/screens/Send";
import { Settings } from "./src/screens/Settings";
import { Transactions } from "./src/screens/Transactions";
import { TxDetail } from "./src/screens/TxDetail";
import { StoreProvider, useStore } from "./src/state/store";
import { C, F } from "./src/theme";

const queryClient = new QueryClient();
const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.canvas, card: C.card, border: C.border, primary: C.accent, text: C.text } };



function VaultApp() {
  const { vaultAddress, setVaultAddress } = useStore();
  const { data: vault, error, isLoading, refetch, refreshing } = useVault(vaultAddress);
  useAlerts(vault);
  if (!vaultAddress) return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
      <Stack.Screen name="Onboard" component={Onboard} />
      <Stack.Screen name="CreateVault" component={CreateVault} />
      <Stack.Screen name="Signers">{() => <Signers vault={undefined} />}</Stack.Screen>
      <Stack.Screen name="Simulator">{() => <Simulator vault={undefined} />}</Stack.Screen>
      <Stack.Screen name="Scan" component={Scan} />
    </Stack.Navigator>
  );
  if (error && !vault) return (
    <Screen top={<TopBar left={<Logo size={28} />} />}>
      <Notice tone="bad">Could not read the vault. {(error as Error).message}</Notice>
      <View style={{ height: 12 }} />
      <Button icon="refresh-cw" onPress={refetch}>Try again</Button>
      <Button kind="ghost" onPress={() => void setVaultAddress(null)}>Open another vault</Button>
    </Screen>
  );
  if (isLoading || !vault) return <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.accent} /><Text style={{ color: C.text2, marginTop: 12, fontFamily: F.body }}>Reading the vault from the chain…</Text></View>;
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING).length;
  const TabsScreen = () => (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarShowLabel: false, tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 84 }, tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.text2 }}>
      <Tabs.Screen name="Home" options={{ tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} /> }}>{() => <Home vault={vault} refetch={refetch} refreshing={refreshing} />}</Tabs.Screen>
      <Tabs.Screen name="Transactions" options={{ tabBarIcon: ({ color }) => <Feather name="repeat" size={24} color={color} />, tabBarBadge: pending || undefined, tabBarBadgeStyle: { backgroundColor: C.accent, color: C.onAccent, fontFamily: F.bodyBold, fontSize: 11 } }}>{() => <Transactions vault={vault} refetch={refetch} refreshing={refreshing} />}</Tabs.Screen>
      <Tabs.Screen name="Settings" options={{ tabBarIcon: ({ color }) => <Feather name="settings" size={24} color={color} /> }}>{() => <Settings vault={vault} />}</Tabs.Screen>
    </Tabs.Navigator>
  );
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
      <Stack.Screen name="Main" component={TabsScreen} />
      <Stack.Screen name="TxDetail">{() => <TxDetail vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Send" options={{ presentation: "modal" }}>{() => <Send vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Receive" options={{ presentation: "modal" }}>{() => <Receive vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Security">{() => <Security vault={vault} refetch={refetch} refreshing={refreshing} />}</Stack.Screen>
      <Stack.Screen name="AddressBook">{() => <AddressBook vault={vault} refetch={refetch} refreshing={refreshing} />}</Stack.Screen>
      <Stack.Screen name="Members">{() => <Members vault={vault} refetch={refetch} refreshing={refreshing} />}</Stack.Screen>
      <Stack.Screen name="Policy">{() => <Policy vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Simulator">{() => <Simulator vault={vault} />}</Stack.Screen>
      <Stack.Screen name="CreateVault" component={CreateVault} />
      <Stack.Screen name="Signers">{() => <Signers vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Notifications">{() => <NotificationsScreen vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Scan" component={Scan} />
    </Stack.Navigator>
  );
}

export const navigationRef = createNavigationContainerRef<RootParams>();
const ROUTES: Record<string, keyof RootParams | [keyof RootParams, string]> = {
  home: ["Main", "Home"], transactions: ["Main", "Transactions"], settings: ["Main", "Settings"],
  send: "Send", receive: "Receive", security: "Security", addressbook: "AddressBook", members: "Members",
  policy: "Policy", simulator: "Simulator", create: "CreateVault", signers: "Signers", updates: "Notifications", scan: "Scan",
};

/**
 * Deep links, including the ones notifications carry: skur://tx/<id>, skur://vault/<address>, and one per screen.
 * Links that arrive before the navigator is mounted (cold start, vault still loading) are queued, not dropped.
 */
function useDeepLinks(ready: boolean) {
  const { setVaultAddress, importSigner, setOnboarded } = useStore();
  const queued = useRef<string | null>(null);
  const go = useCallback((target: keyof RootParams | [keyof RootParams, string], params?: object) => {
    if (!navigationRef.isReady()) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigationRef.navigate as unknown as (name: string, params?: object) => void;
    if (Array.isArray(target)) nav(target[0], { screen: target[1], ...(params ?? {}) });
    else nav(target, params);
    return true;
  }, []);
  const handle = useCallback((url: string | null): void => {
    if (!url) return;
    const { hostname, path } = Linking.parse(url);
    const segs = [hostname ?? "", ...(path ?? "").split("/")].filter(Boolean);
    const [head, ...rest] = segs;
    // Opening a different vault returns to Home: a pushed screen belongs to the vault you left.
    if (head === "vault" && rest[0] && isAddress(rest[0])) { void setVaultAddress(rest[0] as `0x${string}`); go(["Main", "Home"]); return; }
    if (__DEV__ && head === "dev" && rest[0] === "signer" && rest[1]) { void importSigner(rest[1]).catch(() => undefined); return; }
    if (__DEV__ && head === "dev" && rest[0] === "onboarding") { void setOnboarded(false); void setVaultAddress(null); return; }
    if (head === "tx" && rest[0]) { if (!go("TxDetail", { id: rest[0] })) queued.current = url; return; }
    const route = ROUTES[head ?? ""];
    if (route && !go(route)) queued.current = url;
  }, [setVaultAddress, importSigner, setOnboarded, go]);
  useEffect(() => {
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    const nsub = Notifications.addNotificationResponseReceivedListener((r) => {
      const u = (r.notification.request.content.data as { url?: string } | undefined)?.url;
      if (u) handle(u);
    });
    return () => { sub.remove(); nsub.remove(); };
  }, [handle]);
  // Replay a link that arrived before the navigator existed.
  useEffect(() => { if (ready && queued.current) { const u = queued.current; queued.current = null; setTimeout(() => handle(u), 60); } }, [ready, handle]);
}

function Gate() {
  const { ready, onboarded, setOnboarded, vaultAddress } = useStore();
  const [navReady, setNavReady] = useState(false);
  useDeepLinks(navReady);
  useEffect(() => { const t = setInterval(() => { if (navigationRef.isReady()) { setNavReady(true); clearInterval(t); } }, 120); return () => clearInterval(t); }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}><Logo size={72} wordmark={false} /></View>;
  if (!onboarded && !vaultAddress) return <Welcome onDone={() => void setOnboarded()} />;
  return <VaultApp />;
}

type TabParams = { Home: undefined; Transactions: undefined; Settings: undefined };
type RootParams = { Main: NavigatorScreenParams<TabParams>; TxDetail: { id: string }; Send: undefined; Receive: undefined; Security: undefined; AddressBook: undefined; Members: undefined; Policy: undefined; Simulator: undefined; CreateVault: undefined; Signers: undefined; Notifications: undefined; Scan: undefined };

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, DMMono_400Regular, DMMono_500Medium });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: "#ffffff" }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StoreProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <StatusBar style="light" />
            <Gate />
          </NavigationContainer>
        </StoreProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
