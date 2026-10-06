import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { HAS_SERVER, currentUser, supabase } from '../data/supabase';
import { targetOf, type NotificationTarget } from './target';

export type { NotificationTarget } from './target';

/**
 * Push notifications.
 *
 * Why they exist, with evidence. In STEP UP (JAMA, randomised trial, 602 adults) competition was
 * the only format whose effect lasted after the gamification was switched off, and what lasted
 * was competition WITH REAL SOCIAL TIES. Knowing that someone just scored is that tie. And only
 * 3% of health app users are still active after 30 days.
 *
 * ⚠️ Why there are FEW of them. Self-determination theory says notifications without judgement
 * create controlled motivation, which predicts dropping out. Only meaningful events notify; the
 * rest is noise.
 *
 * ⛔ APPLE RULE, and it shapes the message. The rule is literal: information obtained from
 * HealthKit cannot be disclosed to a third party without the user's express permission.
 *   ✅ fine: "Marta scored 88 points. One of her strongest sessions."
 *   ⛔ not fine: anything with heart rate, zones or minutes of effort.
 * It comes for free because only the score reaches the server, but it is written here so nobody
 * breaks it.
 */

/** How a notification looks while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushStatus =
  | { kind: 'ready'; token: string }
  | { kind: 'no-permission' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

/**
 * Asks for permission and returns the Expo push token.
 *
 * Permission is checked before asking, so the sheet is never shown again to someone who
 * already said yes.
 */
export async function preparePush(): Promise<PushStatus> {
  // The simulator has no push. Not an error: it just does not apply.
  if (!Device.isDevice) return { kind: 'unsupported' };

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;

    if (!granted && current.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return { kind: 'no-permission' };

    const { data } = await Notifications.getExpoPushTokenAsync();
    return { kind: 'ready', token: data };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Stores the token on the profile, which is where the server reads it from.
 *
 * ⚠️ It has to be kept current. Apple and Google can block apps that keep sending to devices
 * that blocked notifications or uninstalled the app, so dead tokens are cleaned up on the server
 * by reading the delivery receipts.
 */
export async function saveToken(token: string): Promise<void> {
  if (!HAS_SERVER) return;

  const user = await currentUser();

  const { error } = await supabase.from('perfiles').update({ push_token: token }).eq('id', user);
  if (error) throw error;
}

/**
 * On sign-out the token is released, so a phone that is no longer yours stops getting alerts.
 *
 * ⚠️ If the update fails, it THROWS, like `saveToken`. It used to swallow the error, and a
 * sign-out without network silently left the token alive on the profile: league notifications
 * (names and points included) kept reaching a phone that was no longer yours. The caller decides
 * whether it can tolerate the failure (account deletion can: the cascade removes the token
 * anyway) or must abort (sign-out).
 */
export async function releaseToken(): Promise<void> {
  if (!HAS_SERVER) return;

  const user = await currentUser();

  const { error } = await supabase.from('perfiles').update({ push_token: null }).eq('id', user);
  if (error) throw error;
}

/**
 * Android channel. Does nothing on iOS, but the app declares Android in app.json and without a
 * channel notifications arrive muted.
 */
export async function prepareChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('ligas', {
    name: 'Leagues',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

/**
 * Listens for taps on notifications and tells the app where to go. Returns the function that
 * stops listening. It also covers the notification that OPENED the app from closed, which on iOS
 * does not go through the listener.
 */
export function listenForTaps(onTarget: (target: NotificationTarget) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const target = targetOf(response.notification.request.content.data);
    if (target !== null) onTarget(target);
  });
  void Notifications.getLastNotificationResponseAsync()
    .then((last) => {
      const target = last === null ? null : targetOf(last.notification.request.content.data);
      if (target !== null) onTarget(target);
    })
    .catch(() => undefined);
  return () => sub.remove();
}
