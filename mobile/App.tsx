import './src/lib/polyfills';

import { useFonts } from 'expo-font';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Icon } from './src/components/ui';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** The activity tab owns its own stack, so a proposal opens over it rather than replacing it. */
function ActivityStack() {
  const [open, setOpen] = useState<bigint | null>(null);
  if (open !== null) return <TxDetail id={open} onBack={() => setOpen(null)} />;
  return <Transactions onOpen={setOpen} />;
}

function Tabs() {
  const C = useTheme();
  const [tab, setTab] = useState(0);
  return (
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
      <Tab.Screen name="Treasury">
        {() => <Home onOpenQueue={() => setTab(1)} onSwitch={() => undefined} />}
      </Tab.Screen>
      <Tab.Screen name="Activity" component={ActivityStack} />
      <Tab.Screen name="Pay">{() => <Send onDone={() => undefined} />}</Tab.Screen>
      <Tab.Screen name="Receive" component={Receive} />
      <Tab.Screen name="Security" component={Security} />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

/** Decides what the app is: an introduction, a key to set up, a vault to pick, or the vault. */
function Root() {
  const C = useTheme();
  const { dark } = useScheme();
  const { ready, onboarded, address, vaultId, finishOnboarding } = useStore();
  const [seenWelcome, setSeenWelcome] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.text3} />
      </View>
    );
  }

  const nav = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: { ...(dark ? DarkTheme : DefaultTheme).colors, background: C.canvas, card: C.canvas, border: C.border, text: C.text, primary: C.accent },
  };

  return (
    <NavigationContainer theme={nav}>
      <StatusBar style={dark ? 'light' : 'dark'} />
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
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StoreProvider>{loaded ? <Root /> : null}</StoreProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
