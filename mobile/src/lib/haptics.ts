import * as Haptics from 'expo-haptics';

/**
 * Touch feedback for the moments that matter: a transaction settling, a transaction refused.
 * Wrapped so a platform without a haptic engine degrades to nothing instead of a rejection
 * nobody handles.
 */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export function hapticTap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
