import { describe, expect, it } from '@jest/globals';

import { emptySnapshot } from '@/features/notion/mapping';
import { PROPERTY_NAMES } from '@/features/notion/types';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import type { MonthEntry } from '@/lib/supabase';

import { snapshotToMonthEntry, upsertMonthEntry } from './use-save-today';

const baseSnap: TodayEntrySnapshot = {
  ...emptySnapshot('2026-05-25'),
  notionPageId: 'page-1',
  feeling: '(^^)',
  feelingColor: 'green',
  icon: { type: 'emoji', emoji: '🌱' },
  diary: 'AIまとめ',
  habits: {
    output: true,
    book: false,
    design: true,
    english: false,
    exercise: true,
  },
  bodyMarkdown: '本文',
  coverUrl: 'https://example.com/c.jpg',
};

describe('snapshotToMonthEntry', () => {
  it('returns null when the page has not been created yet', () => {
    const snap = { ...baseSnap, notionPageId: null };
    expect(snapshotToMonthEntry(snap)).toBeNull();
  });

  it('remaps lowercase habit keys to Notion property names', () => {
    const me = snapshotToMonthEntry(baseSnap);
    expect(me).not.toBeNull();
    expect(me?.habits).toEqual({
      [PROPERTY_NAMES.output]: true,
      [PROPERTY_NAMES.book]: false,
      [PROPERTY_NAMES.design]: true,
      [PROPERTY_NAMES.english]: false,
      [PROPERTY_NAMES.exercise]: true,
    });
  });

  it('carries feeling, color, icon, diary, coverUrl through', () => {
    const me = snapshotToMonthEntry(baseSnap);
    expect(me).toMatchObject({
      pageId: 'page-1',
      date: '2026-05-25',
      feeling: '(^^)',
      feelingColor: 'green',
      icon: { type: 'emoji', emoji: '🌱' },
      diary: 'AIまとめ',
      coverUrl: 'https://example.com/c.jpg',
    });
  });

  it('omits non-month fields (tracked, bodyMarkdown)', () => {
    const me = snapshotToMonthEntry(baseSnap);
    expect(me).not.toHaveProperty('tracked');
    expect(me).not.toHaveProperty('bodyMarkdown');
  });
});

describe('upsertMonthEntry', () => {
  const existing: MonthEntry[] = [
    {
      pageId: 'page-a',
      date: '2026-05-24',
      feeling: '(TT)',
      feelingColor: 'blue',
      icon: null,
      habits: { Output: false, Book: true },
      diary: '前日のDIARY',
      coverUrl: null,
    },
    {
      pageId: 'page-b',
      date: '2026-05-25',
      feeling: null,
      feelingColor: null,
      icon: null,
      habits: { Output: false, Book: false, Custom: true },
      diary: '',
      coverUrl: null,
    },
  ];

  it('updates the matching date entry in place', () => {
    const next = snapshotToMonthEntry(baseSnap);
    const out = upsertMonthEntry(existing, next);
    expect(out).toHaveLength(2);
    const updated = out.find((e) => e.date === '2026-05-25');
    expect(updated?.feeling).toBe('(^^)');
    expect(updated?.diary).toBe('AIまとめ');
  });

  it('preserves habit columns the server reported but the snapshot does not model', () => {
    const next = snapshotToMonthEntry(baseSnap);
    const out = upsertMonthEntry(existing, next);
    const updated = out.find((e) => e.date === '2026-05-25');
    // "Custom" was on the server but isn't in HABITS — it must survive.
    expect(updated?.habits.Custom).toBe(true);
    // Modeled habits take the new value.
    expect(updated?.habits[PROPERTY_NAMES.output]).toBe(true);
    expect(updated?.habits[PROPERTY_NAMES.design]).toBe(true);
  });

  it('appends when no entry exists for the date', () => {
    const newSnap: TodayEntrySnapshot = {
      ...emptySnapshot('2026-05-30'),
      notionPageId: 'page-new',
      feeling: '(^^)',
    };
    const next = snapshotToMonthEntry(newSnap);
    const out = upsertMonthEntry(existing, next);
    expect(out).toHaveLength(3);
    expect(out[2].date).toBe('2026-05-30');
  });

  it('is a no-op when next is null (unsaved page)', () => {
    const out = upsertMonthEntry(existing, null);
    expect(out).toBe(existing);
  });

  it('does not mutate the input list', () => {
    const next = snapshotToMonthEntry(baseSnap);
    const before = JSON.stringify(existing);
    upsertMonthEntry(existing, next);
    expect(JSON.stringify(existing)).toBe(before);
  });
});
