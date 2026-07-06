import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import type { ReminderData } from './scheduler';

/**
 * Foreground display + tap routing for reminder notifications.
 *
 * - `setNotificationHandler` makes reminders show as a banner even when
 *   the app is already in the foreground (default behavior is to swallow
 *   foreground notifications — surprising for a journaling app).
 * - On tap, we read the `dateKey` from the notification payload and push
 *   the calendar tab with `?date=…`. The calendar screen consumes that
 *   param to auto-open the Day Drawer for that date.
 * - We also check `getLastNotificationResponseAsync` to handle the
 *   cold-start case (app was killed when the user tapped the notification).
 */

let handlerInstalled = false;

function installForegroundHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function extractDateKey(response: Notifications.NotificationResponse | null): string | null {
  if (!response) return null;
  const data = response.notification.request.content.data as
    | Partial<ReminderData>
    | undefined;
  if (data?.kind !== 'reminder' || typeof data.dateKey !== 'string') return null;
  return data.dateKey;
}

export function useNotificationTap(): void {
  const router = useRouter();

  useEffect(() => {
    installForegroundHandler();

    let cancelled = false;

    const openForDate = (dateKey: string) => {
      // The calendar tab (which consumes `?date=` by opening that day's
      // drawer) lives at `/(tabs)/calendar` — index is the きょう tab.
      router.navigate({ pathname: '/calendar', params: { date: dateKey } });
    };

    // Cold start: was the app launched by tapping a reminder?
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled) return;
      const dateKey = extractDateKey(response);
      if (dateKey) openForDate(dateKey);
    });

    // Warm taps: the app was already running.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const dateKey = extractDateKey(response);
      if (dateKey) openForDate(dateKey);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router]);
}
