import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  DEFAULT_PREFS,
  MAX_MODES,
  activeViewMode,
  addMode,
  loadCalendarPrefs,
  removeMode,
  renameMode,
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
    expect(activeViewMode(prefs).label).toBe('写真');
    expect(activeViewMode(prefs).showCover).toBe(true);
    expect(prefs.modes.map((m) => m.label)).toEqual(['写真', 'きろく', '習慣']);
    expect(prefs.modes[2].habits).toBe('all');
  });

  it('round-trips a customized, variable-length mode list', async () => {
    const custom = {
      activeMode: 3,
      modes: [
        { ...DEFAULT_PREFS.modes[0], label: 'アルバム' },
        { ...DEFAULT_PREFS.modes[1] },
        { ...DEFAULT_PREFS.modes[2], habits: ['Book'] },
        { label: '英語だけ', showCover: false, showDiary: false, showMark: false, habits: ['English'] },
      ],
    };
    await saveCalendarPrefs(custom);
    expect(await loadCalendarPrefs()).toEqual(custom);
  });

  it('fills missing mode fields from defaults (generic fallback past index 2)', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ modes: [{ showCover: false }, {}, {}, {}], activeMode: 0 }),
    );
    const prefs = await loadCalendarPrefs();
    expect(prefs.modes[0].showCover).toBe(false);
    expect(prefs.modes[0].label).toBe('写真');
    expect(prefs.modes[3].label).toBe('モード4');
  });

  it('caps the stored mode list at MAX_MODES and clamps activeMode', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ modes: Array.from({ length: 9 }, () => ({})), activeMode: 9 }),
    );
    const prefs = await loadCalendarPrefs();
    expect(prefs.modes).toHaveLength(MAX_MODES);
    expect(prefs.activeMode).toBe(MAX_MODES - 1);
  });

  it('falls back to defaults for the pre-modes schema and malformed JSON', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ habitOverlay: ['Book'], showDiary: true, showCover: false }),
    );
    expect(await loadCalendarPrefs()).toEqual(DEFAULT_PREFS);
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

describe('mode list editing helpers', () => {
  it('addMode appends a template mode and makes it active', () => {
    const next = addMode(DEFAULT_PREFS);
    expect(next.modes).toHaveLength(4);
    expect(next.activeMode).toBe(3);
    expect(next.modes[3].label).toBe('モード4');
  });

  it('addMode is a no-op at MAX_MODES', () => {
    let prefs = DEFAULT_PREFS;
    for (let i = 0; i < 10; i++) prefs = addMode(prefs);
    expect(prefs.modes).toHaveLength(MAX_MODES);
  });

  it('removeMode drops the mode and keeps a valid active index', () => {
    const prefs = { ...DEFAULT_PREFS, activeMode: 2 };
    const next = removeMode(prefs, 2);
    expect(next.modes).toHaveLength(2);
    expect(next.activeMode).toBe(1);
  });

  it('removeMode shifts the active index when an earlier mode is removed', () => {
    const prefs = { ...DEFAULT_PREFS, activeMode: 2 };
    const next = removeMode(prefs, 0);
    expect(next.modes.map((m) => m.label)).toEqual(['きろく', '習慣']);
    expect(next.activeMode).toBe(1); // still 習慣
  });

  it('removeMode refuses to remove the last remaining mode', () => {
    let prefs = DEFAULT_PREFS;
    prefs = removeMode(prefs, 0);
    prefs = removeMode(prefs, 0);
    expect(prefs.modes).toHaveLength(1);
    expect(removeMode(prefs, 0)).toBe(prefs);
  });

  it('renameMode updates only the target label', () => {
    const next = renameMode(DEFAULT_PREFS, 1, 'ダイアリー');
    expect(next.modes[1].label).toBe('ダイアリー');
    expect(next.modes[0].label).toBe('写真');
  });
});
