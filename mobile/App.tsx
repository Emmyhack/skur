import './src/lib/polyfills';

import { useFonts } from 'expo-font';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigation,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Icon, OfflineBanner } from './src/components/ui';
import { useOnline } from './src/hooks/useOnline';
import { NETWORK } from './src/lib/config';
import { parseLink } from './src/lib/links';
import { useNotificationTaps } from './src/lib/notifications';
import { persister } from './src/lib/persist';
import { StoreProvider, useStore } from './src/state/store';
import { ThemeProvider, useScheme, useTheme } from './src/state/theme';
import { F } from './src/theme';
import { Home } from './src/screens/Home';
import { Onboard } from './src/screens/Onboard';
import { OpenVault } from './src/screens/OpenVault';
import { Receive } from './src/screens/Receive';
import { Security } from './src/screens/Security';
import { Send } from './src/screens/Send';
import { Settings } from './src/screens/Settings';
import { Transactions } from './src/screens/Transactions';
import { TxDetail } from './src/screens/TxDetail';
import { Welcome } from './src/screens/Welcome';

/**
 * Reads are cached to disk, so a cold start offline shows the vault as it last was — the offline
 * banner states its age. Only vault reads persist: a transfer preview is a quote, and a stale
 * quote shown as current is worse than none.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 24 * 3_600_000,
    },
  },
});

const persistOptions = {
  persister,
  maxAge: 24 * 3_600_000,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === 'vault',
  },
};

/** Route params are serialisable by contract, so a proposal id travels as a string. */
type ActivityParams = { Queue: undefined; Proposal: { id: string } };
type TabParams = {
  Treasury: undefined;
  Activity: NavigatorScreenParams<ActivityParams>;
  Pay: undefined;
  Receive: undefined;
  Security: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParams>();
const ActivityNav = createNativeStackNavigator<ActivityParams>();
const navRef = createNavigationContainerRef<TabParams>();

/**
 * The queue and a proposal are a real stack, not a component swapped by local state. That is what
 * makes Android's hardware back close the proposal instead of the app, gives iOS its swipe-back,
 * and gives a deep link something to target.
 */
function ActivityStack() {
  return (
    <ActivityNav.Navigator screenOptions={{ headerShown: false }}>
      <ActivityNav.Screen name="Queue">
        {({ navigation }) => (
          <Transactions onOpen={(id) => navigation.navigate('Proposal', { id: id.toString() })} />
        )}
      </ActivityNav.Screen>
      <ActivityNav.Screen name="Proposal">
        {({ route, navigation }: NativeStackScreenProps<ActivityParams, 'Proposal'>) => (
          <TxDetail id={BigInt(route.params.id)} onBack={() => navigation.goBack()} />
        )}
      </ActivityNav.Screen>
    </ActivityNav.Navigator>
  );
}

function TreasuryTab() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParams>>();
  const { closeVault } = useStore();
  return (
    <Home
      onOpenQueue={() => navigation.navigate('Activity', { screen: 'Queue' })}
      onSwitch={closeVault}
    />
  );
}

function PayTab() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParams>>();
  // After a payment opens, land on the queue — that is where it now lives.
  return <Send onDone={() => navigation.navigate('Activity', { screen: 'Queue' })} />;
}

/** The banner sits above the tabs, with the age of what is on screen. */
function ConnectionBanner() {
  const online = useOnline();
  const { vaultId } = useStore();
  const qc = useQueryClient();
  if (online) return null;
  const asOf = vaultId ? qc.getQueryState(['vault', NETWORK, vaultId])?.dataUpdatedAt : undefined;
  return <OfflineBanner asOf={asOf} />;
}

function Tabs() {
  const C = useTheme();
  return (
    <>
      <ConnectionBanner />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: C.text,
          tabBarInactiveTintColor: C.text3,
          tabBarStyle: { backgroundColor: C.canvas, borderTopColor: C.border },
          tabBarLabelStyle: { fontFamily: F.bodyMedium, fontSize: 11 },
          tabBarIcon: ({ color }) => {
            const name =
              route.name === 'Treasury'
                ? 'home'
                : route.name === 'Activity'
                  ? 'list'
                  : route.name === 'Pay'
                    ? 'arrow-up-right'
                    : route.name === 'Receive'
                      ? 'download'
                      : route.name === 'Security'
                        ? 'shield'
                        : 'settings';
            return <Icon name={name} size={19} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Treasury" component={TreasuryTab} />
        <Tab.Screen name="Activity" component={ActivityStack} />
        <Tab.Screen name="Pay" component={PayTab} />
        <Tab.Screen name="Receive" component={Receive} />
        <Tab.Screen name="Security" component={Security} />
        <Tab.Screen name="Settings" component={Settings} />
      </Tab.Navigator>
    </>
  );
}

/**
 * Deep links: skur://vault/0x…, skur://proposal/42, skur://vault/0x…/proposal/42.
 *
 * A link can arrive before the navigator mounts, before the store loads, or before any vault is
 * open — tapping a notification cold-starts the app into exactly that state. So links queue, and
 * the queue drains when everything the link needs is ready. The old build lost early links for
 * precisely this reason.
 */
function DeepLinks({ navReady }: { navReady: boolean }) {
  const url = Linking.useURL();
  const { ready, address, vaultId, openVault } = useStore();
  const pending = useRef<ReturnType<typeof parseLink>>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || url === handled.current) return;
    const parsed = parseLink(url);
    if (!parsed) return;
    handled.current = url;
    pending.current = parsed;
    if (parsed.kind === 'vault') openVault(parsed.vaultId);
  }, [url, openVault]);

  useEffect(() => {
    const link = pending.current;
    if (!link || !navReady || !ready || !address || !vaultId) return;
    const proposalId = link.kind === 'proposal' ? link.proposalId : link.proposalId;
    pending.current = null;
    if (proposalId && navRef.isReady()) {
      navRef.navigate('Activity', { screen: 'Proposal', params: { id: proposalId } });
    }
  });

  return null;
}

/** An introduction, a key to set up, a vault to pick, or the vault. */
function Root() {
  useNotificationTaps();
  const C = useTheme();
  const { dark } = useScheme();
  const { ready, onboarded, address, vaultId, finishOnboarding } = useStore();
  const [seenWelcome, setSeenWelcome] = useState(false);
  const [navReady, setNavReady] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.text3} />
      </View>
    );
  }

  const nav = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      background: C.canvas,
      card: C.canvas,
      border: C.border,
      text: C.text,
      primary: C.accent,
    },
  };

  return (
    <NavigationContainer ref={navRef} theme={nav} onReady={() => setNavReady(true)}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <DeepLinks navReady={navReady} />
      {!onboarded && !seenWelcome ? (
        <Welcome onStart={() => setSeenWelcome(true)} />
      ) : !address ? (
        <Onboard onDone={finishOnboarding} />
      ) : !vaultId ? (
        <OpenVault />
      ) : (
        <Tabs />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [loaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ThemeProvider>
            <StoreProvider>{loaded ? <Root /> : null}</StoreProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
