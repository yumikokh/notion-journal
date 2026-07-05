import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  DEFAULT_PREFS,
  activeViewMode,
  loadCalendarPrefs,
  saveCalendarPrefs,
} from './calendar-prefs';

const KEY = 'notion-journal.calendar_prefs';

describe('calendar-prefs (view modes)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns DEFAULT_PREFS when nothing is stored', async () => {
    expect(await loadCalendarPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('defaults to photo mode (cover on) with record/habit presets', async () => {
    const prefs = await loadCalendarPrefs();
    expect(activeViewMode(prefs).key).toBe('photo');
    expect(activeViewMode(prefs).showCover).toBe(true);
    expect(prefs.modes.map((m) => m.key)).toEqual(['photo', 'record', 'habit']);
    expect(prefs.modes[2].habits).toBe('all');
  });

  it('round-trips customized modes through AsyncStorage', async () => {
    const custom = {
      ...DEFAULT_PREFS,
      activeMode: 2,
      modes: [
        { ...DEFAULT_PREFS.modes[0], showDiary: true },
        { ...DEFAULT_PREFS.modes[1], showCover: true },
        { ...DEFAULT_PREFS.modes[2], habits: ['Book', 'Exercise'] },
      ],
    };
    await saveCalendarPrefs(custom);
    expect(await loadCalendarPrefs()).toEqual(custom);
  });

  it('fills missing mode fields from the defaults', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ modes: [{ showCover: false }, {}, {}], activeMode: 0 }),
    );
    const prefs = await loadCalendarPrefs();
    expect(prefs.modes[0].showCover).toBe(false);
    expect(prefs.modes[0].label).toBe('写真');
    expect(prefs.modes[2].habits).toBe('all');
  });

  it('clamps a stored activeMode outside the valid range', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ modes: [{}, {}, {}], activeMode: 9 }));
    expect((await loadCalendarPrefs()).activeMode).toBe(2);
  });

  it('falls back to defaults for the pre-modes schema', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ habitOverlay: ['Book'], showDiary: true, showCover: false }),
    );
    expect(await loadCalendarPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('falls back to defaults on malformed JSON', async () => {
    await AsyncStorage.setItem(KEY, '{not-json');
    expect(await loadCalendarPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('keeps only string habit names in an explicit list', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ modes: [{}, {}, { habits: ['Book', 7, null] }], activeMode: 0 }),
    );
    expect((await loadCalendarPrefs()).modes[2].habits).toEqual(['Book']);
  });
});
