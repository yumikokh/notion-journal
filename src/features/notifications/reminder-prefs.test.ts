import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  DEFAULT_REMINDER_SETTINGS,
  REMINDER_SETTINGS_KEY,
  loadReminderSettings,
  saveReminderSettings,
} from './reminder-prefs';

describe('reminder-prefs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns DEFAULT_REMINDER_SETTINGS when nothing is stored', async () => {
    expect(await loadReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('round-trips a fully populated value', async () => {
    const value: import('./reminder-prefs').ReminderSettings = {
      dailyEnabled: true,
      dailyTime: '07:30',
      dailyDays: [1, 3, 5],
      weeklyEnabled: true,
      weeklyTime: '20:00',
      weeklyDay: 7,
      skipIfRecorded: false,
    };
    await saveReminderSettings(value);
    expect(await loadReminderSettings()).toEqual(value);
  });

  it('drops invalid weekday numbers and de-duplicates dailyDays', async () => {
    await AsyncStorage.setItem(
      REMINDER_SETTINGS_KEY,
      JSON.stringify({
        dailyEnabled: true,
        dailyTime: '09:00',
        dailyDays: [1, 1, 0, 8, 5, '3'],
        weeklyEnabled: false,
        weeklyTime: '20:00',
        weeklyDay: 7,
        skipIfRecorded: true,
      }),
    );
    expect((await loadReminderSettings()).dailyDays).toEqual([1, 5]);
  });

  it('falls back to default time when stored time is malformed', async () => {
    await AsyncStorage.setItem(
      REMINDER_SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_REMINDER_SETTINGS, dailyTime: '25:99' }),
    );
    expect((await loadReminderSettings()).dailyTime).toBe(
      DEFAULT_REMINDER_SETTINGS.dailyTime,
    );
  });

  it('falls back to defaults on malformed JSON', async () => {
    await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, '{not-json');
    expect(await loadReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('fills in missing fields with defaults', async () => {
    await AsyncStorage.setItem(
      REMINDER_SETTINGS_KEY,
      JSON.stringify({ dailyEnabled: true }),
    );
    const result = await loadReminderSettings();
    expect(result.dailyEnabled).toBe(true);
    expect(result.dailyTime).toBe(DEFAULT_REMINDER_SETTINGS.dailyTime);
    expect(result.weeklyDay).toBe(DEFAULT_REMINDER_SETTINGS.weeklyDay);
    expect(result.skipIfRecorded).toBe(true);
  });
});
