import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Reminder notification preferences.
 *
 * Schema mirrors `.claude/DATA_MODEL.md` §AsyncStorage `reminder_settings`:
 *   - dailyDays / weeklyDay use ISO weekday numbers: 1=Mon ... 7=Sun.
 *   - dailyTime / weeklyTime are stored as zero-padded "HH:MM" strings.
 *   - skipIfRecorded suppresses the daily reminder on days where a Notion
 *     entry already exists (checked at schedule time, not on fire).
 *
 * The local AsyncStorage key follows the project-wide
 * `notion-journal.<name>` convention even though DATA_MODEL.md spells the
 * logical name as bare `reminder_settings`.
 */

const KEY = 'notion-journal.reminder_settings';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReminderSettings = {
  dailyEnabled: boolean;
  dailyTime: string; // "HH:MM"
  dailyDays: Weekday[]; // 1=Mon..7=Sun
  weeklyEnabled: boolean;
  weeklyTime: string; // "HH:MM"
  weeklyDay: Weekday;
  skipIfRecorded: boolean;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  dailyEnabled: false,
  dailyTime: '22:00',
  dailyDays: [1, 2, 3, 4, 5, 6, 7],
  weeklyEnabled: false,
  weeklyTime: '20:00',
  weeklyDay: 7,
  skipIfRecorded: true,
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isWeekday(value: unknown): value is Weekday {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7
  );
}

function parseTime(value: unknown, fallback: string): string {
  return typeof value === 'string' && TIME_RE.test(value) ? value : fallback;
}

function parseDays(value: unknown, fallback: Weekday[]): Weekday[] {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter(isWeekday);
  // De-duplicate and sort for stability across writes/reads.
  return Array.from(new Set(filtered)).sort((a, b) => a - b) as Weekday[];
}

function parse(raw: string | null): ReminderSettings {
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    const obj = JSON.parse(raw) as Partial<Record<keyof ReminderSettings, unknown>>;
    return {
      dailyEnabled:
        typeof obj.dailyEnabled === 'boolean'
          ? obj.dailyEnabled
          : DEFAULT_REMINDER_SETTINGS.dailyEnabled,
      dailyTime: parseTime(obj.dailyTime, DEFAULT_REMINDER_SETTINGS.dailyTime),
      dailyDays: parseDays(obj.dailyDays, DEFAULT_REMINDER_SETTINGS.dailyDays),
      weeklyEnabled:
        typeof obj.weeklyEnabled === 'boolean'
          ? obj.weeklyEnabled
          : DEFAULT_REMINDER_SETTINGS.weeklyEnabled,
      weeklyTime: parseTime(obj.weeklyTime, DEFAULT_REMINDER_SETTINGS.weeklyTime),
      weeklyDay: isWeekday(obj.weeklyDay)
        ? obj.weeklyDay
        : DEFAULT_REMINDER_SETTINGS.weeklyDay,
      skipIfRecorded:
        typeof obj.skipIfRecorded === 'boolean'
          ? obj.skipIfRecorded
          : DEFAULT_REMINDER_SETTINGS.skipIfRecorded,
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    return parse(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

export const REMINDER_SETTINGS_KEY = KEY;
