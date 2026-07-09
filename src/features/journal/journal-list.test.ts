import { describe, expect, it } from '@jest/globals';

import {
  buildMonthDayItems,
  buildMonthOptions,
  formatMonthHeader,
  monthsSince,
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

describe('buildMonthDayItems', () => {
  it('lists every day of a past month in reading order, pairing entries', () => {
    const entries = [makeEntry({ date: '2026-06-15', diary: '良い一日だった' })];
    const items = buildMonthDayItems('2026-06', entries, '2026-07-06');
    expect(items).toHaveLength(30);
    expect(items[0].dateKey).toBe('2026-06-01');
    expect(items[29].dateKey).toBe('2026-06-30');
    expect(items[14].entry?.diary).toBe('良い一日だった');
  });

  it('stops the current month at today (no future days)', () => {
    const items = buildMonthDayItems('2026-07', [], '2026-07-06');
    expect(items).toHaveLength(6);
    expect(items[items.length - 1].dateKey).toBe('2026-07-06');
  });

  it('marks diary or cover as content-worthy, habit-only entries as empty days', () => {
    const entries = [
      makeEntry({ date: '2026-06-01', diary: 'テキスト' }),
      makeEntry({ date: '2026-06-02', coverUrl: 'https://example.com/a.jpg' }),
      makeEntry({ date: '2026-06-03', diary: '   ', habits: { Book: true } }),
    ];
    const items = buildMonthDayItems('2026-06', entries, '2026-07-06');
    expect(items[0].hasContent).toBe(true);
    expect(items[1].hasContent).toBe(true);
    expect(items[2].hasContent).toBe(false);
    expect(items[2].entry?.habits).toEqual({ Book: true }); // feeling/habits still available for the slim row
    expect(items[3].hasContent).toBe(false);
    expect(items[3].entry).toBeNull();
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

describe('buildMonthOptions', () => {
  it('lists the current month plus the requested number of older months, newest first', () => {
    expect(buildMonthOptions('2026-07', 3)).toEqual(['2026-07', '2026-06', '2026-05', '2026-04']);
  });

  it('crosses year boundaries', () => {
    expect(buildMonthOptions('2026-01', 2)).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});

describe('monthsSince', () => {
  it('counts whole months from the earliest entry to the current month', () => {
    expect(monthsSince('2026-05-09', '2026-07')).toBe(2);
    expect(monthsSince('2026-07-01', '2026-07')).toBe(0);
  });

  it('crosses year boundaries and never goes negative', () => {
    expect(monthsSince('2024-11-30', '2026-07')).toBe(20);
    expect(monthsSince('2026-08-01', '2026-07')).toBe(0);
  });
});
