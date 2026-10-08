import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { API_URL } from './config';

/**
 * Push, end to end: the indexer watches the chain, decides who a thing concerns, and sends it to
 * Expo's push service; the device registers its token as a subscription; a tap on the banner opens
 * the exact proposal, through the same deep-link path a pasted URL takes.
 *
 * Remote push needs an EAS project id — Expo's service will not mint a token without one — so
 * everything here degrades honestly: no project id, no indexer, or no permission each produce a
 * stated reason in Settings rather than a silent nothing.
 */
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const severity = (n.request.content.data as { severity?: string } | null)?.severity;
    return {
      // An alert interrupts; information waits in the tray.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: severity === 'alert',
      shouldSetBadge: false,
    };
  },
});

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export type PushResult = { ok: true; token: string } | { ok: false; reason: string };

export async function enablePush(vaultId: string, address: string): Promise<PushResult> {
  if (!API_URL) {
    return { ok: false, reason: 'Push needs the indexer. Set EXPO_PUBLIC_SKUR_API.' };
  }
  if (!projectId()) {
    return {
      ok: false,
      reason: 'Push needs an EAS project id in app.json (extra.eas.projectId). Local and dev builds without one cannot receive remote notifications.',
    };
  }
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, reason: 'Notifications are off for Skur in system settings.' };
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId()! })).data;
  const res = await fetch(`${API_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vaultId, address, channel: 'push', endpoint: token, events: [] }),
  });
  if (!res.ok) return { ok: false, reason: `The indexer refused the registration (${res.status}).` };
  return { ok: true, token };
}

/**
 * Tapping a notification routes through the same deep-link path as a pasted URL, including the
 * cold start — the response that launched the app is read back, because the listener was not
 * alive to hear it.
 */
export function useNotificationTaps() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = (response?.notification.request.content.data as { url?: string } | null)?.url;
      if (url && url.startsWith('skur://')) void Linking.openURL(url);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
