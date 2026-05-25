import { describe, expect, it } from '@jest/globals';

import { emptySnapshot } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import type { MonthEntry } from '@/lib/supabase';

import { clearMonthCover, clearTodayCover } from './use-remove-cover';

describe('clearTodayCover', () => {
  it('returns undefined when there is no cached snapshot yet', () => {
    expect(clearTodayCover(undefined)).toBeUndefined();
  });

  it('sets coverUrl to null and preserves the rest of the snapshot', () => {
    const prev: TodayEntrySnapshot = {
      ...emptySnapshot('2026-05-25'),
      notionPageId: 'page-1',
      feeling: '(^^)',
      coverUrl: 'https://example.com/c.jpg',
    };
    const next = clearTodayCover(prev);
    expect(next?.coverUrl).toBeNull();
    expect(next?.notionPageId).toBe('page-1');
    expect(next?.feeling).toBe('(^^)');
  });
});

describe('clearMonthCover', () => {
  const list: MonthEntry[] = [
    {
      pageId: 'page-a',
      date: '2026-05-24',
      feeling: null,
      feelingColor: null,
      icon: null,
      habits: {},
      diary: '',
      coverUrl: 'https://example.com/a.jpg',
    },
    {
      pageId: 'page-b',
      date: '2026-05-25',
      feeling: null,
      feelingColor: null,
      icon: null,
      habits: {},
      diary: '',
      coverUrl: 'https://example.com/b.jpg',
    },
  ];

  it('returns undefined when the month cache is empty', () => {
    expect(clearMonthCover(undefined, '2026-05-25')).toBeUndefined();
  });

  it('clears coverUrl only on the matching date', () => {
    const next = clearMonthCover(list, '2026-05-25');
    expect(next).not.toBe(list);
    expect(next?.find((e) => e.date === '2026-05-25')?.coverUrl).toBeNull();
    expect(next?.find((e) => e.date === '2026-05-24')?.coverUrl).toBe(
      'https://example.com/a.jpg',
    );
  });

  it('returns the same array reference when nothing matches (avoids re-render)', () => {
    const next = clearMonthCover(list, '2026-05-30');
    expect(next).toBe(list);
  });

  it('returns the same array reference when the matched entry already has no cover', () => {
    const alreadyEmpty: MonthEntry[] = [
      { ...list[1], coverUrl: null },
    ];
    const next = clearMonthCover(alreadyEmpty, '2026-05-25');
    expect(next).toBe(alreadyEmpty);
  });

  it('does not mutate the input list', () => {
    const before = JSON.stringify(list);
    clearMonthCover(list, '2026-05-25');
    expect(JSON.stringify(list)).toBe(before);
  });
});
