import { describe, expect, it } from '@jest/globals';

import { emptySnapshot } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';

import {
  draftReducer,
  draftToSnapshot,
  EMPTY_DRAFT,
  HABIT_ICONS,
  HABIT_KEYS,
  HABITS,
  isDraftDirty,
  snapshotToDraft,
} from './draft';

describe('HABITS', () => {
  it('has an emoji icon for every habit key', () => {
    for (const { key, icon } of HABITS) {
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
      expect(HABIT_ICONS[key]).toBe(icon);
    }
  });

  it('HABIT_KEYS lists every key once in declaration order', () => {
    expect(HABIT_KEYS).toEqual(HABITS.map((h) => h.key));
  });
});

describe('draftReducer', () => {
  it('updates the free-form text without touching structured fields', () => {
    const after = draftReducer(EMPTY_DRAFT, {
      type: 'set-free-text',
      value: '今日は朝ジョギングして気持ちよかった',
    });
    expect(after.freeText).toBe('今日は朝ジョギングして気持ちよかった');
    expect(after.feeling).toBeNull();
    expect(after.diary).toBe('');
  });

  it('sets and clears the feeling', () => {
    const picked = draftReducer(EMPTY_DRAFT, { type: 'set-feeling', value: '(^^)' });
    expect(picked.feeling).toBe('(^^)');

    const cleared = draftReducer(picked, { type: 'set-feeling', value: null });
    expect(cleared.feeling).toBeNull();
  });

  it('updates the diary text', () => {
    const after = draftReducer(EMPTY_DRAFT, { type: 'set-diary', value: '一行日記' });
    expect(after.diary).toBe('一行日記');
  });

  it('toggles a habit independently of others', () => {
    const on = draftReducer(EMPTY_DRAFT, { type: 'toggle-habit', key: 'book' });
    expect(on.habits.book).toBe(true);
    expect(on.habits.output).toBe(false);

    const off = draftReducer(on, { type: 'toggle-habit', key: 'book' });
    expect(off.habits.book).toBe(false);
  });

  it('applies AI diary text without erasing the free text or other fields', () => {
    const seeded = draftReducer(EMPTY_DRAFT, {
      type: 'set-free-text',
      value: 'ジョギングした。仕事で詰まった。',
    });
    const withFeeling = draftReducer(seeded, { type: 'set-feeling', value: '(^^)' });
    const withHabit = draftReducer(withFeeling, { type: 'toggle-habit', key: 'exercise' });

    const after = draftReducer(withHabit, {
      type: 'apply-ai',
      diary: 'ジョギングして気持ちよかった。仕事は詰まったが進んだ。',
    });

    expect(after.freeText).toBe('ジョギングした。仕事で詰まった。');
    expect(after.diary).toBe('ジョギングして気持ちよかった。仕事は詰まったが進んだ。');
    expect(after.feeling).toBe('(^^)');
    expect(after.habits.exercise).toBe(true);
  });

  it('initializes the draft from a Notion snapshot', () => {
    const snap: TodayEntrySnapshot = {
      ...emptySnapshot('2026-05-24'),
      feeling: '(˙-˙)',
      diary: '既存の日記',
      bodyMarkdown: 'つぶやき本文',
    };
    const after = draftReducer(EMPTY_DRAFT, { type: 'init', from: snap });
    expect(after.freeText).toBe('つぶやき本文');
    expect(after.feeling).toBe('(˙-˙)');
    expect(after.diary).toBe('既存の日記');
  });

  it('does not mutate the input state', () => {
    draftReducer(EMPTY_DRAFT, { type: 'set-feeling', value: '(TT)' });
    expect(EMPTY_DRAFT.feeling).toBeNull();
  });
});

describe('snapshotToDraft', () => {
  it('projects a snapshot down to draft fields', () => {
    const snap: TodayEntrySnapshot = {
      ...emptySnapshot('2026-05-24'),
      feeling: '(TT)',
      diary: '日記',
      habits: {
        output: true,
        book: false,
        design: false,
        english: false,
        exercise: true,
      },
      bodyMarkdown: 'body',
      tracked: 'toggl info',
    };
    const draft = snapshotToDraft(snap);
    expect(draft.freeText).toBe('body');
    expect(draft.feeling).toBe('(TT)');
    expect(draft.diary).toBe('日記');
    expect(draft.habits.exercise).toBe(true);
    expect('tracked' in draft).toBe(false);
  });
});

describe('isDraftDirty', () => {
  const baseSnap: TodayEntrySnapshot = {
    ...emptySnapshot('2026-05-25'),
    feeling: '(^^)',
    diary: 'AIまとめ',
    habits: {
      output: true,
      book: false,
      design: false,
      english: false,
      exercise: false,
    },
    bodyMarkdown: 'もとの本文',
  };

  it('is false for a draft that equals the server snapshot', () => {
    const draft = snapshotToDraft(baseSnap);
    expect(isDraftDirty(draft, baseSnap, baseSnap.bodyMarkdown, false)).toBe(false);
  });

  it('is true when a pending cover photo is set, even with no other changes', () => {
    const draft = snapshotToDraft(baseSnap);
    expect(isDraftDirty(draft, baseSnap, baseSnap.bodyMarkdown, true)).toBe(true);
  });

  it('is true when the feeling changes', () => {
    const draft = { ...snapshotToDraft(baseSnap), feeling: '(TT)' as const };
    expect(isDraftDirty(draft, baseSnap, baseSnap.bodyMarkdown, false)).toBe(true);
  });

  it('is true when a habit toggles', () => {
    const draft = snapshotToDraft(baseSnap);
    draft.habits = { ...draft.habits, book: true };
    expect(isDraftDirty(draft, baseSnap, baseSnap.bodyMarkdown, false)).toBe(true);
  });

  it('compares body against lastSyncedBody, not the stale snapshot', () => {
    // After save, lastSyncedBody is updated; the snapshot may lag.
    const draft = { ...snapshotToDraft(baseSnap), freeText: '保存済みの新本文' };
    expect(isDraftDirty(draft, baseSnap, '保存済みの新本文', false)).toBe(false);
  });

  it('falls back to snapshot body when lastSyncedBody is null (initial load)', () => {
    const draft = { ...snapshotToDraft(baseSnap), freeText: 'いじった' };
    expect(isDraftDirty(draft, baseSnap, null, false)).toBe(true);
  });

  it('treats a new page (no snapshot) with whitespace-only content as not dirty', () => {
    const draft = { ...EMPTY_DRAFT, freeText: '   \n  ' };
    expect(isDraftDirty(draft, null, null, false)).toBe(false);
  });

  it('treats a new page (no snapshot) with any real content as dirty', () => {
    const draft = { ...EMPTY_DRAFT, diary: '一行' };
    expect(isDraftDirty(draft, null, null, false)).toBe(true);
  });
});

describe('draftToSnapshot', () => {
  it('preserves base fields the draft does not own', () => {
    const base: TodayEntrySnapshot = {
      ...emptySnapshot('2026-05-24'),
      notionPageId: 'page-123',
      tracked: '6h work',
    };
    const draft = { ...EMPTY_DRAFT, freeText: 'new body', feeling: '(^^)' as const };
    const merged = draftToSnapshot(draft, base);
    expect(merged.notionPageId).toBe('page-123');
    expect(merged.date).toBe('2026-05-24');
    expect(merged.tracked).toBe('6h work');
    expect(merged.bodyMarkdown).toBe('new body');
    expect(merged.feeling).toBe('(^^)');
  });
});
