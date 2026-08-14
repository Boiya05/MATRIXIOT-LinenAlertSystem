/**
 * lib/notifications.ts
 *
 * Local (on-device) notifications for theft alerts - deliberately not
 * remote push. Remote push needs server-side infrastructure (a
 * Supabase Edge Function calling Expo's push API) to fire while the
 * app is fully closed, which is a separate, bigger feature. Local
 * notifications - triggered from hooks/use-theft-alerts.ts's existing
 * live Realtime subscription while the app is open or
 * backgrounded-but-running - only need on-device code, and are fully
 * supported in Expo Go on both iOS and Android (unlike remote push,
 * which Expo Go on Android dropped in SDK 53). So this works
 * identically in Expo Go and in the real EAS-built app.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AlertEvent } from '@/data/linen-data';

const THEFT_ALERTS_CHANNEL_ID = 'theft-alerts';

let isConfigured = false;

/**
 * Sets how notifications should be presented while the app is in the
 * foreground, and (Android only) creates the notification channel
 * theft alerts are delivered through. Call once, e.g. from the root
 * layout - safe to call more than once, only does real work the first
 * time. No-ops on web: expo-notifications' web support doesn't cover
 * this the same way, and the in-app Home screen already covers
 * alerting there while the tab is open.
 */
export function configureNotifications() {
  if (isConfigured || Platform.OS === 'web') return;
  isConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(THEFT_ALERTS_CHANNEL_ID, {
      name: 'Theft alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    }).catch((err) => {
      console.warn('Failed to set up the theft alerts notification channel:', err);
    });
  }
}

/**
 * Checks current permission status without prompting - used before
 * firing a notification so a background Realtime event never itself
 * triggers an OS permission dialog out of context.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('Failed to check notification permission:', err);
    return false;
  }
}

/**
 * Prompts the user for notification permission. Call this from an
 * explicit user action - turning on the "Theft alerts" toggle in
 * Settings - not proactively on app launch, so the OS permission
 * dialog only appears when it's obviously relevant to what the person
 * just did.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return false;
  }
}

/**
 * Checks current permission status, and only prompts for it if it's
 * never actually been decided yet (`undetermined`). Deliberately does
 * NOT re-prompt after an explicit denial - Android would show the OS
 * dialog again on every call, which is obnoxious, and iOS won't
 * re-show it anyway, so the outcome would be inconsistent.
 *
 * This exists for the case requestNotificationPermission() alone
 * doesn't cover: someone whose "Theft alerts" setting was already
 * saved as `true` from before this feature existed. The Settings
 * toggle's onValueChange only fires on an actual off->on flip, so a
 * setting that loads in already-on would otherwise never trigger a
 * permission request at all. Call this once whenever settings load
 * and alertsEnabled is true, in addition to the toggle's own handler.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    if (current.status === 'undetermined') {
      return requestNotificationPermission();
    }
    return false;
  } catch (err) {
    console.warn('Failed to check notification permission:', err);
    return false;
  }
}

/**
 * Fires a local notification for a newly-detected theft alert. Only
 * ever call this for genuine new alerts (Realtime INSERT events) -
 * never for dismissals. See hooks/use-theft-alerts.ts.
 */
export async function notifyTheftAlert(alert: AlertEvent, options: { sound: boolean }) {
  if (Platform.OS === 'web') return;
  if (!(await hasNotificationPermission())) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Theft alert',
        body: alert.message,
        sound: options.sound,
        data: { alertId: alert.id },
      },
      trigger: Platform.OS === 'android' ? { channelId: THEFT_ALERTS_CHANNEL_ID } : null,
    });
  } catch (err) {
    console.warn('Failed to show theft alert notification:', err);
  }
}
