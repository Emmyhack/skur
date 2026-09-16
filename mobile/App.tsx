import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DarkTheme, NavigationContainer, type LinkingOptions, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { isAddress } from "viem";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Status } from "@web/lib/types";
import { Notice, Screen } from "./src/components/ui";
import { useVault } from "./src/hooks/useVault";
import { Home } from "./src/screens/Home";
import { Onboard } from "./src/screens/Onboard";
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
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.canvas, card: C.panel, border: C.border, primary: C.accent, text: C.text } };

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 18, fontFamily: F.bodyBold }}>{glyph}</Text>;
}

function VaultApp() {
  const { vaultAddress } = useStore();
  const { data: vault, error, isLoading, refetch, refreshing } = useVault(vaultAddress);
  if (!vaultAddress) return <Onboard />;
  if (error && !vault) return <Screen title="Skur"><Notice tone="bad">Could not read the vault: {(error as Error).message}</Notice></Screen>;
  if (isLoading || !vault) return <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.accent} /><Text style={{ color: C.text2, marginTop: 12, fontFamily: F.body }}>Reading the vault from the chain…</Text></View>;
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING).length;
  const TabsScreen = () => (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.border }, tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.text2, tabBarLabelStyle: { fontFamily: F.bodyMedium, fontSize: 11 } }}>
      <Tabs.Screen name="Home" options={{ tabBarIcon: ({ color }) => <TabIcon glyph="▣" color={color} /> }}>{() => <Home vault={vault} refetch={refetch} refreshing={refreshing} />}</Tabs.Screen>
      <Tabs.Screen name="Transactions" options={{ tabBarIcon: ({ color }) => <TabIcon glyph="⇄" color={color} />, tabBarBadge: pending || undefined, tabBarBadgeStyle: { backgroundColor: C.accent, color: C.onAccent, fontFamily: F.bodyBold } }}>{() => <Transactions vault={vault} refetch={refetch} refreshing={refreshing} />}</Tabs.Screen>
      <Tabs.Screen name="Security" options={{ tabBarIcon: ({ color }) => <TabIcon glyph="⛨" color={color} /> }}>{() => <Security vault={vault} refetch={refetch} refreshing={refreshing} />}</Tabs.Screen>
      <Tabs.Screen name="Settings" options={{ tabBarIcon: ({ color }) => <TabIcon glyph="⚙" color={color} /> }}>{() => <Settings vault={vault} />}</Tabs.Screen>
    </Tabs.Navigator>
  );
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
      <Stack.Screen name="Main" component={TabsScreen} />
      <Stack.Screen name="TxDetail">{() => <TxDetail vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Send" options={{ presentation: "modal" }}>{() => <Send vault={vault} />}</Stack.Screen>
      <Stack.Screen name="Receive" options={{ presentation: "modal" }}>{() => <Receive vault={vault} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

/** Deep links: skur://vault/<address> opens a vault; skur://dev/signer/<key> loads a signer in development builds only. */
function useDeepLinks() {
  const { setVaultAddress, importSigner } = useStore();
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const { hostname, path } = Linking.parse(url);
      const segs = (path ?? "").split("/").filter(Boolean);
      if (hostname === "vault" && segs[0] && isAddress(segs[0])) void setVaultAddress(segs[0] as `0x${string}`);
      if (__DEV__ && hostname === "dev" && segs[0] === "signer" && segs[1]) void importSigner(segs[1]).catch(() => undefined);
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, [setVaultAddress, importSigner]);
}

function Gate() {
  const { ready } = useStore();
  useDeepLinks();
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.canvas }} />;
  return <VaultApp />;
}

type TabParams = { Home: undefined; Transactions: undefined; Security: undefined; Settings: undefined };
type RootParams = { Main: NavigatorScreenParams<TabParams>; TxDetail: { id: string }; Send: undefined; Receive: undefined };
const linking: LinkingOptions<RootParams> = {
  prefixes: [Linking.createURL("/"), "skur://"],
  config: { screens: { Main: { screens: { Home: "home", Transactions: "transactions", Security: "security", Settings: "settings" } }, TxDetail: "tx/:id", Send: "send", Receive: "receive" } },
};

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, DMMono_400Regular, DMMono_500Medium });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.canvas }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StoreProvider>
          <NavigationContainer theme={navTheme} linking={linking}>
            <StatusBar style="light" />
            <Gate />
          </NavigationContainer>
        </StoreProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
