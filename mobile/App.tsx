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
import * as SplashScreen from 'expo-splash-screen';
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

import { Launch } from './src/screens/onboarding/Launch';
import { Tour } from './src/screens/onboarding/Tour';
import { Start } from './src/screens/onboarding/Start';
import { CreateAccount } from './src/screens/onboarding/CreateAccount';
import { CreateOrg, type OrgDraft } from './src/screens/onboarding/CreateOrg';
import { AddMembers, type MemberDraft } from './src/screens/onboarding/AddMembers';
import { ConnectWallet } from './src/screens/onboarding/ConnectWallet';

import { ActivityLog } from './src/screens/ActivityLog';
import { Dashboard } from './src/screens/Dashboard';
import { Help } from './src/screens/Help';
import { Home } from './src/screens/Home';
import { More } from './src/screens/More';
import { OpenVault } from './src/screens/OpenVault';
import { Policies } from './src/screens/Policies';
import { Receive } from './src/screens/Receive';
import { Roles } from './src/screens/Roles';
import { Security } from './src/screens/Security';
import { Send } from './src/screens/Send';
import { Settings } from './src/screens/Settings';
import { Team } from './src/screens/Team';
import { Transactions } from './src/screens/Transactions';
import { TxDetail } from './src/screens/TxDetail';

// Keep the mark on screen until the fonts exist; hiding early flashes a bare canvas.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
    // Only settled vault reads. A query dehydrated while still pending is rehydrated as a
    // promise that nothing will ever resolve — react-query rejects it on restore and logs a
    // warning over the UI.
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) =>
      q.queryKey[0] === 'vault' && q.state.status === 'success',
  },
};

/** Route params are serialisable by contract, so a proposal id travels as a string. */
type ProposalsParams = { Queue: undefined; Proposal: { id: string }; New: undefined };
type TeamParams = { Members: undefined; Roles: undefined };
type MoreParams = {
  Menu: undefined;
  SecurityCenter: undefined;
  Policies: undefined;
  Logs: undefined;
  ReceiveScreen: undefined;
  SettingsScreen: undefined;
  Help: undefined;
};
type TabParams = {
  Home: undefined;
  Treasury: undefined;
  Proposals: NavigatorScreenParams<ProposalsParams>;
  Team: NavigatorScreenParams<TeamParams>;
  More: NavigatorScreenParams<MoreParams>;
};

const Tab = createBottomTabNavigator<TabParams>();
const ProposalsNav = createNativeStackNavigator<ProposalsParams>();
const TeamNav = createNativeStackNavigator<TeamParams>();
const MoreNav = createNativeStackNavigator<MoreParams>();
const navRef = createNavigationContainerRef<TabParams>();

/**
 * Stacks, not component swaps: Android's hardware back closes the inner screen instead of the
 * app, iOS keeps its swipe-back, and a deep link has something to target.
 */
function ProposalsStack() {
  return (
    <ProposalsNav.Navigator screenOptions={{ headerShown: false }}>
      <ProposalsNav.Screen name="Queue">
        {({ navigation }) => (
          <Transactions onOpen={(id) => navigation.navigate('Proposal', { id: id.toString() })} />
        )}
      </ProposalsNav.Screen>
      <ProposalsNav.Screen name="Proposal">
        {({ route, navigation }: NativeStackScreenProps<ProposalsParams, 'Proposal'>) => (
          <TxDetail id={BigInt(route.params.id)} onBack={() => navigation.goBack()} />
        )}
      </ProposalsNav.Screen>
      <ProposalsNav.Screen name="New">
        {({ navigation }) => <Send onDone={() => navigation.navigate('Queue')} />}
      </ProposalsNav.Screen>
    </ProposalsNav.Navigator>
  );
}

function TeamStack() {
  return (
    <TeamNav.Navigator screenOptions={{ headerShown: false }}>
      <TeamNav.Screen name="Members">
        {({ navigation }) => <Team onOpenRoles={() => navigation.navigate('Roles')} />}
      </TeamNav.Screen>
      <TeamNav.Screen name="Roles">
        {({ navigation }) => <Roles onBack={() => navigation.goBack()} />}
      </TeamNav.Screen>
    </TeamNav.Navigator>
  );
}

function MoreStack() {
  return (
    <MoreNav.Navigator screenOptions={{ headerShown: false }}>
      <MoreNav.Screen name="Menu">
        {({ navigation }) => (
          <More
            onOpen={(screen) =>
              navigation.navigate(
                screen === 'Security'
                  ? 'SecurityCenter'
                  : screen === 'Receive'
                    ? 'ReceiveScreen'
                    : screen === 'Settings'
                      ? 'SettingsScreen'
                      : screen,
              )
            }
          />
        )}
      </MoreNav.Screen>
      <MoreNav.Screen name="SecurityCenter" component={Security} />
      <MoreNav.Screen name="Policies">
        {({ navigation }) => <Policies onBack={() => navigation.goBack()} />}
      </MoreNav.Screen>
      <MoreNav.Screen name="Logs">
        {({ navigation }) => <ActivityLog onBack={() => navigation.goBack()} />}
      </MoreNav.Screen>
      <MoreNav.Screen name="ReceiveScreen" component={Receive} />
      <MoreNav.Screen name="SettingsScreen">
        {({ navigation }) => (
          <Settings
            onOpenHelp={() => navigation.navigate('Help')}
            onOpenSecurity={() => navigation.navigate('SecurityCenter')}
          />
        )}
      </MoreNav.Screen>
      <MoreNav.Screen name="Help">
        {({ navigation }) => <Help onBack={() => navigation.goBack()} />}
      </MoreNav.Screen>
    </MoreNav.Navigator>
  );
}

function HomeTab() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParams>>();
  const { closeVault } = useStore();
  return (
    <Dashboard
      onOpenProposals={() => navigation.navigate('Proposals', { screen: 'Queue' })}
      onOpenProposal={(id) => navigation.navigate('Proposals', { screen: 'Proposal', params: { id: id.toString() } })}
      onOpenTreasury={() => navigation.navigate('Treasury')}
      onSwitch={closeVault}
    />
  );
}

function TreasuryTab() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParams>>();
  const { closeVault } = useStore();
  return (
    <Home
      onOpenQueue={() => navigation.navigate('Proposals', { screen: 'Queue' })}
      onSend={() => navigation.navigate('Proposals', { screen: 'New' })}
      onRequest={() => navigation.navigate('More', { screen: 'ReceiveScreen' })}
      onSwitch={closeVault}
    />
  );
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
              route.name === 'Home'
                ? 'home'
                : route.name === 'Treasury'
                  ? 'pie-chart'
                  : route.name === 'Proposals'
                    ? 'list'
                    : route.name === 'Team'
                      ? 'users'
                      : 'more-horizontal';
            return <Icon name={name} size={19} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeTab} />
        <Tab.Screen name="Treasury" component={TreasuryTab} />
        <Tab.Screen name="Proposals" component={ProposalsStack} />
        <Tab.Screen name="Team" component={TeamStack} />
        <Tab.Screen name="More" component={MoreStack} />
      </Tab.Navigator>
    </>
  );
}

/**
 * Deep links: skur://vault/0x…, skur://proposal/42, skur://vault/0x…/proposal/42.
 *
 * A link can arrive before the navigator mounts, before the store loads, or before any vault is
 * open — tapping a notification cold-starts the app into exactly that state. So links queue, and
 * the queue drains when everything the link needs is ready.
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
    const proposalId = link.proposalId;
    pending.current = null;
    if (proposalId && navRef.isReady()) {
      navRef.navigate('Proposals', { screen: 'Proposal', params: { id: proposalId } });
    }
  });

  return null;
}

type OnboardStep = 'launch' | 'tour' | 'start' | 'account' | 'org' | 'members' | 'wallet';

/**
 * Screens 1–7 as one flow. "Create" walks the whole path and ends with the vault created on
 * chain; "Join" skips the organisation and lands on the key, then the vault picker.
 */
function Onboarding({ onDone }: { onDone: () => void }) {
  const { address } = useStore();
  // A device that already holds a key skips the marketing and goes straight to the fork — but a
  // key created mid-flow must NOT reset the flow, so this is the initial step only.
  const [step, setStep] = useState<OnboardStep>(address ? 'start' : 'launch');
  const [org, setOrg] = useState<OrgDraft | null>(null);
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [joining, setJoining] = useState(false);

  switch (step) {
    case 'launch':
      return <Launch onStart={() => setStep('tour')} />;
    case 'tour':
      return <Tour onDone={() => setStep('start')} />;
    case 'start':
      return (
        <Start
          onCreate={() => {
            setJoining(false);
            setStep('account');
          }}
          onJoin={() => {
            setJoining(true);
            setStep('account');
          }}
        />
      );
    case 'account':
      return (
        <CreateAccount
          onBack={() => setStep('start')}
          onDone={() => setStep(joining ? 'wallet' : 'org')}
          onWallet={() => {
            // "Continue with Wallet": straight to the key; the vault picker follows.
            setJoining(true);
            setStep('wallet');
          }}
        />
      );
    case 'org':
      return (
        <CreateOrg
          draft={org}
          onBack={() => setStep('account')}
          onDone={(draft) => {
            setOrg(draft);
            setStep('members');
          }}
        />
      );
    case 'members':
      return (
        <AddMembers
          members={members}
          onBack={() => setStep('org')}
          onDone={(list) => {
            setMembers(list);
            setStep('wallet');
          }}
        />
      );
    case 'wallet':
      return (
        <ConnectWallet
          draft={joining ? null : org}
          members={members}
          onBack={() => setStep(joining ? 'account' : 'members')}
          onDone={onDone}
        />
      );
  }
}

/** An introduction, a key to set up, a vault to pick, or the vault. */
function Root() {
  useNotificationTaps();
  const C = useTheme();
  const { dark } = useScheme();
  const { ready, onboarded, address, vaultId, finishOnboarding } = useStore();
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
      {address && vaultId ? (
        <Tabs />
      ) : !onboarded || !address ? (
        // The flow owns the screen until it says it is done. Creating the key mid-flow flips
        // `address`, and an address-based gate here would unmount the flow one step before it
        // creates the organisation — which is exactly the bug this ordering exists to prevent.
        <Onboarding onDone={finishOnboarding} />
      ) : (
        <OpenVault />
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

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

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
