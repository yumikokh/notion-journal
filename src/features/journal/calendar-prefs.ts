import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Calendar display preferences, organized as switchable "view modes"
 * (表示モード). Switching what the calendar shows is a frequent one-tap
 * action; customizing the modes — their contents, names, and how many
 * exist (1〜MAX_MODES) — is an occasional edit. The mode sheet separates
 * the two.
 *
 * Each mode controls:
 *   - showCover: Notion page cover as the cell background
 *   - showDiary: small diary-text snippet inside the cell
 *   - showMark:  the feeling / page-icon mark
 *   - habits:    habit-icon overlay — 'all' shows every checked habit,
 *                a list shows only those names, [] shows none. When any
 *                habit icons are shown they take the mark's spot.
 */

const KEY = 'notion-journal.calendar_prefs';

export const MAX_MODES = 5;

export type HabitSelection = 'all' | string[];

export type CalendarViewMode = {
  label: string;
  showCover: boolean;
  showDiary: boolean;
  showMark: boolean;
  habits: HabitSelection;
};

export type CalendarPrefs = {
  modes: CalendarViewMode[];
  activeMode: number;
};

/** Contents a brand-new user-added mode starts from. */
export const NEW_MODE_TEMPLATE: CalendarViewMode = {
  label: '',
  showCover: true,
  showDiary: false,
  showMark: true,
  habits: [],
};

export const DEFAULT_PREFS: CalendarPrefs = {
  modes: [
    { label: '写真', showCover: true, showDiary: false, showMark: false, habits: [] },
    { label: 'きろく', showCover: false, showDiary: true, showMark: true, habits: [] },
    { label: '習慣', showCover: false, showDiary: false, showMark: false, habits: 'all' },
  ],
  activeMode: 0,
};

export function activeViewMode(prefs: CalendarPrefs): CalendarViewMode {
  return prefs.modes[prefs.activeMode] ?? prefs.modes[0];
}

/** Append a new mode (up to MAX_MODES) and make it active. */
export function addMode(prefs: CalendarPrefs): CalendarPrefs {
  if (prefs.modes.length >= MAX_MODES) return prefs;
  const label = `モード${prefs.modes.length + 1}`;
  return {
    modes: [...prefs.modes, { ...NEW_MODE_TEMPLATE, label }],
    activeMode: prefs.modes.length,
  };
}

/** Remove a mode (the last one can't be removed) and keep a valid active index. */
export function removeMode(prefs: CalendarPrefs, index: number): CalendarPrefs {
  if (prefs.modes.length <= 1 || index < 0 || index >= prefs.modes.length) return prefs;
  const modes = prefs.modes.filter((_, i) => i !== index);
  const activeMode =
    prefs.activeMode > index
      ? prefs.activeMode - 1
      : Math.min(prefs.activeMode, modes.length - 1);
  return { modes, activeMode };
}

export function renameMode(prefs: CalendarPrefs, index: number, label: string): CalendarPrefs {
  if (index < 0 || index >= prefs.modes.length) return prefs;
  return {
    ...prefs,
    modes: prefs.modes.map((m, i) => (i === index ? { ...m, label } : m)),
  };
}

function parseHabits(value: unknown): HabitSelection | null {
  if (value === 'all') return 'all';
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return null;
}

function parseMode(value: unknown, index: number): CalendarViewMode {
  const fallback = DEFAULT_PREFS.modes[index] ?? {
    ...NEW_MODE_TEMPLATE,
    label: `モード${index + 1}`,
  };
  if (typeof value !== 'object' || value === null) return fallback;
  const obj = value as Record<string, unknown>;
  return {
    label: typeof obj.label === 'string' && obj.label.trim() !== '' ? obj.label : fallback.label,
    showCover: typeof obj.showCover === 'boolean' ? obj.showCover : fallback.showCover,
    showDiary: typeof obj.showDiary === 'boolean' ? obj.showDiary : fallback.showDiary,
    showMark: typeof obj.showMark === 'boolean' ? obj.showMark : fallback.showMark,
    habits: parseHabits(obj.habits) ?? fallback.habits,
  };
}

function parse(raw: string | null): CalendarPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const obj = JSON.parse(raw) as { modes?: unknown; activeMode?: unknown };
    // Data from the pre-modes schema (flat showCover/showDiary/habitOverlay)
    // simply falls back to the defaults — no migration for a personal app.
    const rawModes: unknown = obj.modes;
    if (!Array.isArray(rawModes) || rawModes.length === 0) return DEFAULT_PREFS;
    const modes = rawModes.slice(0, MAX_MODES).map((m, i) => parseMode(m, i));
    const activeRaw = typeof obj.activeMode === 'number' ? obj.activeMode : 0;
    const activeMode = Math.max(0, Math.min(modes.length - 1, Math.trunc(activeRaw)));
    return { modes, activeMode };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function loadCalendarPrefs(): Promise<CalendarPrefs> {
  try {
    return parse(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveCalendarPrefs(prefs: CalendarPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
