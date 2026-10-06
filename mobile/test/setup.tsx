
/**
 * Native modules the screens touch. Each mock is the smallest thing that lets the component tree
 * render — the point of these tests is the app's own logic, not Expo's.
 */
jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { SKUR_NETWORK: 'testnet', SKUR_PACKAGE_ID: '0xpkg' } } },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: jest.fn(async (k: string) => void store.delete(k)),
    },
  };
});

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

// Silence the act() noise from react-query's background refetches; the tests await what matters.
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
  warn(...args);
};

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-linking', () => ({
  useURL: jest.fn(() => null),
  openURL: jest.fn(async () => true),
  createURL: jest.fn((p: string) => `skur://${p}`),
}));
