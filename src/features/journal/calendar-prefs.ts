import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Calendar display preferences, organized as three switchable "view modes"
 * (表示モード). Switching what the calendar shows is a frequent one-tap
 * action; customizing what each mode contains is an occasional edit — the
 * mode sheet separates the two.
 *
 * Each mode controls:
 *   - showCover: Notion page cover as the cell background
 *   - showDiary: small diary-text snippet inside the cell
 *   - showMark:  the feeling / page-icon mark
 *   - habits:    habit-icon overlay — 'all' shows every checked habit,
 *                a list shows only those names, [] shows none. When any
 *                habit icons are shown they take the mark's spot.
 *
 * Mode identities are fixed (photo / record / habit) so storage stays
 * stable; their contents are user-editable.
 */

const KEY = 'notion-journal.calendar_prefs';

export type HabitSelection = 'all' | string[];

export type CalendarViewMode = {
  key: 'photo' | 'record' | 'habit';
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

export const DEFAULT_PREFS: CalendarPrefs = {
  modes: [
    {
      key: 'photo',
      label: '写真',
      showCover: true,
      showDiary: false,
      showMark: false,
      habits: [],
    },
    {
      key: 'record',
      label: 'きろく',
      showCover: false,
      showDiary: true,
      showMark: true,
      habits: [],
    },
    {
      key: 'habit',
      label: '習慣',
      showCover: false,
      showDiary: false,
      showMark: false,
      habits: 'all',
    },
  ],
  activeMode: 0,
};

export function activeViewMode(prefs: CalendarPrefs): CalendarViewMode {
  return prefs.modes[prefs.activeMode] ?? prefs.modes[0];
}

function parseHabits(value: unknown): HabitSelection | null {
  if (value === 'all') return 'all';
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return null;
}

function parseMode(value: unknown, fallback: CalendarViewMode): CalendarViewMode {
  if (typeof value !== 'object' || value === null) return fallback;
  const obj = value as Record<string, unknown>;
  return {
    key: fallback.key,
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
    if (!Array.isArray(rawModes)) return DEFAULT_PREFS;
    const modes = DEFAULT_PREFS.modes.map((fallback, i) => parseMode(rawModes[i], fallback));
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
