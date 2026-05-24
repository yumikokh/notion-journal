import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  DEFAULT_PREFS,
  loadCalendarPrefs,
  saveCalendarPrefs,
} from './calendar-prefs';

const KEY = 'notion-journal.calendar_prefs';

describe('calendar-prefs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns DEFAULT_PREFS when nothing is stored', async () => {
    expect(await loadCalendarPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('round-trips selected habits through AsyncStorage', async () => {
    await saveCalendarPrefs({
      habitOverlay: ['Book', 'Exercise'],
      showDiary: true,
      showCover: false,
    });
    expect(await loadCalendarPrefs()).toEqual({
      habitOverlay: ['Book', 'Exercise'],
      showDiary: true,
      showCover: false,
    });
  });

  it('defaults showDiary / showCover to false when missing from stored data', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ habitOverlay: ['Book'] }));
    const prefs = await loadCalendarPrefs();
    expect(prefs.showDiary).toBe(false);
    expect(prefs.showCover).toBe(false);
  });

  it('keeps any string habit name from stored data (no allowlist)', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ habitOverlay: ['Book', 'Meditation', 'Exercise'] }),
    );
    expect((await loadCalendarPrefs()).habitOverlay).toEqual([
      'Book',
      'Meditation',
      'Exercise',
    ]);
  });

  it('falls back to defaults on malformed JSON', async () => {
    await AsyncStorage.setItem(KEY, '{not-json');
    expect(await loadCalendarPrefs()).toEqual(DEFAULT_PREFS);
  });
});
