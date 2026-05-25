import { toDateKey } from '@/lib/date';

import type { ReminderSettings, Weekday } from './reminder-prefs';

export type PlannedReminder = {
  kind: 'daily' | 'weekly';
  /** Local-time wall clock when the notification should fire. */
  fireAt: Date;
  /** `YYYY-MM-DD` of the day this reminder is for (matches `fireAt`). */
  dateKey: string;
};

/** Convert JS Date#getDay (0=Sun..6=Sat) to ISO weekday (1=Mon..7=Sun). */
export function isoWeekday(date: Date): Weekday {
  const jsDay = date.getDay();
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

/** Parse "HH:MM" into [hour, minute]. Falls back to [0, 0] on bad input. */
function parseHHMM(value: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

function atTime(base: Date, hhmm: string): Date {
  const [h, m] = parseHHMM(hhmm);
  const next = new Date(base);
  next.setHours(h, m, 0, 0);
  return next;
}

export type BuildScheduleInput = {
  settings: ReminderSettings;
  now: Date;
  /** Set of `YYYY-MM-DD` keys that already have a Notion entry. */
  recordedDates: ReadonlySet<string>;
  /** How many days ahead (including today) to schedule. Default 14. */
  horizonDays?: number;
};

/**
 * Project the reminder settings into a concrete list of notifications to
 * schedule for the next `horizonDays` days.
 *
 * Pure function: no I/O, no `expo-notifications` import. The scheduler
 * (which talks to the OS) consumes this output. The test suite exercises:
 *   - day-of-week mask (`dailyDays`)
 *   - `skipIfRecorded` for daily (weekly never skipped — it's a digest)
 *   - past-time skip for today (fireAt must be strictly future)
 *   - both daily and weekly firing on the same day at different times
 *
 * The 14-day horizon stays well under iOS's 64 pending-notification cap
 * even when both daily and weekly are enabled (max 14 + 2 = 16).
 */
export function buildSchedule({
  settings,
  now,
  recordedDates,
  horizonDays = 14,
}: BuildScheduleInput): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const dailyDays = new Set<Weekday>(settings.dailyDays);

  for (let i = 0; i < horizonDays; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    day.setHours(0, 0, 0, 0);
    const dayKey = toDateKey(day);
    const weekday = isoWeekday(day);

    if (settings.dailyEnabled && dailyDays.has(weekday)) {
      const fireAt = atTime(day, settings.dailyTime);
      const recorded = settings.skipIfRecorded && recordedDates.has(dayKey);
      if (fireAt.getTime() > now.getTime() && !recorded) {
        out.push({ kind: 'daily', fireAt, dateKey: dayKey });
      }
    }

    if (settings.weeklyEnabled && weekday === settings.weeklyDay) {
      const fireAt = atTime(day, settings.weeklyTime);
      if (fireAt.getTime() > now.getTime()) {
        out.push({ kind: 'weekly', fireAt, dateKey: dayKey });
      }
    }
  }

  return out;
}
