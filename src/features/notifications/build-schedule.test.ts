import { describe, expect, it } from '@jest/globals';

import { buildSchedule, isoWeekday } from './build-schedule';
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from './reminder-prefs';

// Reference date: 2026-05-25 is a Monday (ISO weekday = 1).
const MONDAY_AM = new Date(2026, 4, 25, 10, 0, 0); // local time
const MONDAY_PM_AFTER = new Date(2026, 4, 25, 23, 0, 0); // after 22:00

const baseEnabled = (overrides: Partial<ReminderSettings> = {}): ReminderSettings => ({
  ...DEFAULT_REMINDER_SETTINGS,
  dailyEnabled: true,
  ...overrides,
});

describe('isoWeekday', () => {
  it('maps Sunday (JS 0) to 7 and Monday to 1', () => {
    expect(isoWeekday(new Date(2026, 4, 24))).toBe(7); // Sun
    expect(isoWeekday(new Date(2026, 4, 25))).toBe(1); // Mon
    expect(isoWeekday(new Date(2026, 4, 30))).toBe(6); // Sat
  });
});

describe('buildSchedule', () => {
  it('returns nothing when both daily and weekly are disabled', () => {
    const result = buildSchedule({
      settings: DEFAULT_REMINDER_SETTINGS, // both disabled
      now: MONDAY_AM,
      recordedDates: new Set(),
    });
    expect(result).toEqual([]);
  });

  it('schedules 14 daily reminders when all weekdays are selected', () => {
    const result = buildSchedule({
      settings: baseEnabled({ dailyTime: '22:00' }),
      now: MONDAY_AM,
      recordedDates: new Set(),
    });
    expect(result).toHaveLength(14);
    expect(result.every((r) => r.kind === 'daily')).toBe(true);
    // First reminder is today (Mon 2026-05-25) at 22:00 local.
    expect(result[0].dateKey).toBe('2026-05-25');
    expect(result[0].fireAt.getHours()).toBe(22);
    expect(result[0].fireAt.getMinutes()).toBe(0);
  });

  it("skips today when the daily time has already passed", () => {
    const result = buildSchedule({
      settings: baseEnabled({ dailyTime: '22:00' }),
      now: MONDAY_PM_AFTER, // 23:00, after 22:00
      recordedDates: new Set(),
    });
    expect(result).toHaveLength(13);
    expect(result[0].dateKey).toBe('2026-05-26');
  });

  it('honours the dailyDays weekday mask (weekdays only)', () => {
    const result = buildSchedule({
      settings: baseEnabled({ dailyDays: [1, 2, 3, 4, 5] }), // Mon-Fri
      now: MONDAY_AM,
      recordedDates: new Set(),
    });
    // 14-day window starting Mon: weeks have 5 + 5 + 0 weekdays so 10.
    expect(result).toHaveLength(10);
    expect(result.map((r) => r.dateKey)).not.toContain('2026-05-30'); // Sat
    expect(result.map((r) => r.dateKey)).not.toContain('2026-05-31'); // Sun
  });

  it('skips daily reminders on days already recorded when skipIfRecorded=true', () => {
    const result = buildSchedule({
      settings: baseEnabled({ dailyTime: '22:00', skipIfRecorded: true }),
      now: MONDAY_AM,
      recordedDates: new Set(['2026-05-25', '2026-05-26']),
    });
    expect(result).toHaveLength(12);
    expect(result.map((r) => r.dateKey)).not.toContain('2026-05-25');
    expect(result.map((r) => r.dateKey)).not.toContain('2026-05-26');
  });

  it('does NOT skip recorded days when skipIfRecorded=false', () => {
    const result = buildSchedule({
      settings: baseEnabled({ skipIfRecorded: false }),
      now: MONDAY_AM,
      recordedDates: new Set(['2026-05-25']),
    });
    expect(result).toHaveLength(14);
    expect(result.map((r) => r.dateKey)).toContain('2026-05-25');
  });

  it('emits weekly reminders only on the configured weekday', () => {
    const result = buildSchedule({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        weeklyEnabled: true,
        weeklyTime: '20:00',
        weeklyDay: 7, // Sunday
      },
      now: MONDAY_AM, // 2026-05-25 Mon
      recordedDates: new Set(),
    });
    // 14-day window from Mon 5/25 covers Sun 5/31 and Sun 6/7 = 2 Sundays.
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.kind === 'weekly')).toBe(true);
    expect(result.map((r) => r.dateKey)).toEqual(['2026-05-31', '2026-06-07']);
  });

  it('does NOT skip weekly reminders for recorded days', () => {
    const result = buildSchedule({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        weeklyEnabled: true,
        weeklyDay: 7,
        skipIfRecorded: true,
      },
      now: MONDAY_AM,
      recordedDates: new Set(['2026-05-31']),
    });
    expect(result.map((r) => r.dateKey)).toContain('2026-05-31');
  });

  it('emits both daily and weekly on the same day when both fire', () => {
    const result = buildSchedule({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        dailyEnabled: true,
        dailyTime: '22:00',
        weeklyEnabled: true,
        weeklyTime: '20:00',
        weeklyDay: 1, // Mon — same as MONDAY_AM
      },
      now: MONDAY_AM,
      recordedDates: new Set(),
      horizonDays: 1,
    });
    // Today only: 1 daily + 1 weekly.
    expect(result).toHaveLength(2);
    const kinds = result.map((r) => r.kind).sort();
    expect(kinds).toEqual(['daily', 'weekly']);
  });
});
