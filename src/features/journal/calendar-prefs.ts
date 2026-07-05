import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Calendar display preferences.
 *
 * `habitOverlay` is the set of habit names (Notion property names like
 * "Output", "Book") whose icons should be shown on each calendar cell.
 * Names come from the server's dynamic checkbox enumeration — the app no
 * longer pins this list to a fixed 5-habit set.
 *
 * `showDiary` / `showCover` are cell-content overrides:
 *   - showCover: render the Notion page cover as the cell background.
 *     Defaults to ON — the photo-first calendar is the primary way entries
 *     are browsed, so covers should show up without extra setup.
 *   - showDiary: render a small diary-text snippet inside the cell.
 * Both can be on simultaneously (diary text over cover).
 */

const KEY = 'notion-journal.calendar_prefs';

export type CalendarPrefs = {
  habitOverlay: string[];
  showDiary: boolean;
  showCover: boolean;
};

export const DEFAULT_PREFS: CalendarPrefs = {
  habitOverlay: [],
  showDiary: false,
  showCover: true,
};

function parse(raw: string | null): CalendarPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const obj = JSON.parse(raw) as {
      habitOverlay?: unknown;
      showDiary?: unknown;
      showCover?: unknown;
    };
    const overlay = Array.isArray(obj.habitOverlay)
      ? obj.habitOverlay.filter((v): v is string => typeof v === 'string')
      : [];
    return {
      habitOverlay: overlay,
      showDiary: typeof obj.showDiary === 'boolean' ? obj.showDiary : DEFAULT_PREFS.showDiary,
      showCover: typeof obj.showCover === 'boolean' ? obj.showCover : DEFAULT_PREFS.showCover,
    };
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
