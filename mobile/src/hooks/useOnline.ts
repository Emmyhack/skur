import { useNetworkState } from 'expo-network';

/**
 * Whether the device believes it can reach anything.
 *
 * "Believes" is the honest word: a connected radio with a dead backhaul still reports reachable,
 * so this gates banners and copy, never correctness — a read that fails shows its own error with
 * a retry, whatever this says.
 */
export function useOnline(): boolean {
  const state = useNetworkState();
  // Unknown is treated as online, because a false offline banner on launch teaches people to
  // ignore the banner.
  return state.isInternetReachable !== false && state.isConnected !== false;
}
