import * as Notifications from 'expo-notifications';

import { buildSchedule } from './build-schedule';
import { type ReminderSettings } from './reminder-prefs';

/**
 * Side-effecting wrapper around `expo-notifications`:
 *   1. ensure we have permission (no-op if already granted/denied),
 *   2. cancel any previously-scheduled reminders we own,
 *   3. re-emit the next 14 days of reminders based on the current settings
 *      and which days are already recorded in Notion.
 *
 * We tag every notification we own with `data.kind === 'reminder'` so we
 * can later distinguish our scheduled reminders from any other source
 * (push, future widget triggers) without nuking unrelated entries.
 */

const REMINDER_TAG = 'reminder';

type ReminderKind = 'daily' | 'weekly';

export type ReminderData = {
  kind: typeof REMINDER_TAG;
  reminderKind: ReminderKind;
  /** `YYYY-MM-DD` the reminder is *for* (today for daily; the weekly day for weekly). */
  dateKey: string;
};

const CONTENT_BY_KIND: Record<ReminderKind, { title: string; body: string }> = {
  daily: {
    title: '今日の記録、書いてみる？',
    body: 'ひとことだけでも残しておくと、あとで効きます。',
  },
  weekly: {
    title: 'ウィークリーふりかえり',
    body: '今週どうだった？ 充電・放電を振り返ろう。',
  },
};

let permissionPromise: Promise<boolean> | null = null;

/**
 * Request notification permission once per app run. Repeat calls return
 * the same in-flight promise so we don't surface multiple prompts.
 */
export function ensureNotificationPermission(): Promise<boolean> {
  if (permissionPromise) return permissionPromise;
  permissionPromise = (async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return next.granted;
  })();
  return permissionPromise;
}

/** Reset the cached permission promise (test seam / settings re-prompt). */
export function resetPermissionCacheForTesting(): void {
  permissionPromise = null;
}

async function cancelOwnedReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => {
        const data = n.content.data as Partial<ReminderData> | undefined;
        return data?.kind === REMINDER_TAG;
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export type RescheduleInput = {
  settings: ReminderSettings;
  /** `YYYY-MM-DD` keys that already have a Notion entry. */
  recordedDates: ReadonlySet<string>;
  now?: Date;
};

export type RescheduleResult = {
  scheduledCount: number;
  permissionGranted: boolean;
};

/**
 * Compute and apply the next 14 days of reminders. Safe to call from
 * `useEffect`: it cancels its own prior schedule before adding the new
 * one, so repeated calls converge on the same set.
 */
export async function rescheduleReminders({
  settings,
  recordedDates,
  now = new Date(),
}: RescheduleInput): Promise<RescheduleResult> {
  const nothingEnabled = !settings.dailyEnabled && !settings.weeklyEnabled;

  // Always cancel previous reminders so disabling actually disables them.
  await cancelOwnedReminders();

  if (nothingEnabled) {
    return { scheduledCount: 0, permissionGranted: false };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { scheduledCount: 0, permissionGranted: false };
  }

  const planned = buildSchedule({ settings, now, recordedDates });
  for (const item of planned) {
    const content = CONTENT_BY_KIND[item.kind];
    const data: ReminderData = {
      kind: REMINDER_TAG,
      reminderKind: item.kind,
      dateKey: item.dateKey,
    };
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: data as unknown as Record<string, unknown>,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireAt,
      },
    });
  }

  return { scheduledCount: planned.length, permissionGranted: true };
}
