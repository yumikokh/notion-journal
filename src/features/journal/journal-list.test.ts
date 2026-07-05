import { describe, expect, it } from '@jest/globals';

import {
  formatMonthHeader,
  selectJournalListEntries,
  shiftYearMonth,
} from './journal-list';
import type { MonthEntry } from '@/lib/supabase';

function makeEntry(overrides: Partial<MonthEntry>): MonthEntry {
  return {
    pageId: overrides.pageId ?? `page-${overrides.date}`,
    date: overrides.date ?? '2026-07-01',
    feeling: overrides.feeling ?? null,
    feelingColor: overrides.feelingColor ?? null,
    icon: overrides.icon ?? null,
    habits: overrides.habits ?? {},
    diary: overrides.diary ?? '',
    coverUrl: overrides.coverUrl ?? null,
  };
}

describe('selectJournalListEntries', () => {
  it('keeps entries that have diary text only', () => {
    const entries = [makeEntry({ date: '2026-07-01', diary: '良い一日だった' })];
    expect(selectJournalListEntries(entries)).toHaveLength(1);
  });

  it('keeps entries that have a cover photo only', () => {
    const entries = [
      makeEntry({ date: '2026-07-01', diary: '', coverUrl: 'https://example.com/a.jpg' }),
    ];
    expect(selectJournalListEntries(entries)).toHaveLength(1);
  });

  it('drops entries with neither diary nor cover', () => {
    const entries = [
      makeEntry({ date: '2026-07-01', diary: '' }),
      makeEntry({ date: '2026-07-02', diary: '   ' }),
    ];
    expect(selectJournalListEntries(entries)).toHaveLength(0);
  });

  it('sorts the result by date, newest first', () => {
    const entries = [
      makeEntry({ date: '2026-07-01', diary: 'a' }),
      makeEntry({ date: '2026-07-15', diary: 'b' }),
      makeEntry({ date: '2026-07-08', diary: 'c' }),
    ];
    const result = selectJournalListEntries(entries);
    expect(result.map((e) => e.date)).toEqual(['2026-07-15', '2026-07-08', '2026-07-01']);
  });
});

describe('shiftYearMonth', () => {
  it('shifts within the same year', () => {
    expect(shiftYearMonth('2026-07', -1)).toBe('2026-06');
    expect(shiftYearMonth('2026-07', 1)).toBe('2026-08');
  });

  it('crosses a year boundary going backward', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
  });

  it('crosses a year boundary going forward', () => {
    expect(shiftYearMonth('2025-12', 1)).toBe('2026-01');
  });
});

describe('formatMonthHeader', () => {
  it('formats a YYYY-MM string as a Japanese month header', () => {
    expect(formatMonthHeader('2026-07')).toBe('2026年7月');
    expect(formatMonthHeader('2025-01')).toBe('2025年1月');
  });
});
