import { describe, expect, it } from '@jest/globals';

import { emptySnapshot, notionPageToSnapshot, snapshotToNotionUpdate } from './mapping';
import type { NotionPage } from './types';

describe('notionPageToSnapshot', () => {
  it('returns an empty snapshot when page is null', () => {
    const snap = notionPageToSnapshot(null, '', '2026-05-24');
    expect(snap).toEqual(emptySnapshot('2026-05-24'));
  });

  it('extracts properties from a Notion page', () => {
    const page: NotionPage = {
      id: 'page-1',
      properties: {
        Feeling: { type: 'select', select: { name: '(^^)' } },
        Diary: { type: 'rich_text', rich_text: [{ plain_text: '朝ジョギングして気持ちよかった' }] },
        Tracked: { type: 'rich_text', rich_text: [{ plain_text: '6h work' }] },
        Output: { type: 'checkbox', checkbox: false },
        Book: { type: 'checkbox', checkbox: false },
        Design: { type: 'checkbox', checkbox: false },
        English: { type: 'checkbox', checkbox: false },
        Exercise: { type: 'checkbox', checkbox: true },
      },
    };
    const snap = notionPageToSnapshot(page, 'つぶやき本文', '2026-05-24');
    expect(snap.notionPageId).toBe('page-1');
    expect(snap.feeling).toBe('(^^)');
    expect(snap.diary).toBe('朝ジョギングして気持ちよかった');
    expect(snap.tracked).toBe('6h work');
    expect(snap.habits.exercise).toBe(true);
    expect(snap.habits.book).toBe(false);
    expect(snap.bodyMarkdown).toBe('つぶやき本文');
  });

  it('joins multi-segment rich_text into one string', () => {
    const page: NotionPage = {
      id: 'p',
      properties: {
        Diary: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'part1 ' }, { plain_text: 'part2' }],
        },
      },
    };
    const snap = notionPageToSnapshot(page, '', '2026-05-24');
    expect(snap.diary).toBe('part1 part2');
  });

  it('ignores unknown feeling values', () => {
    const page: NotionPage = {
      id: 'p',
      properties: {
        Feeling: { type: 'select', select: { name: 'unknown-emoticon' } },
      },
    };
    const snap = notionPageToSnapshot(page, '', '2026-05-24');
    expect(snap.feeling).toBeNull();
  });

  it('handles a null select value', () => {
    const page: NotionPage = {
      id: 'p',
      properties: {
        Feeling: { type: 'select', select: null },
      },
    };
    const snap = notionPageToSnapshot(page, '', '2026-05-24');
    expect(snap.feeling).toBeNull();
  });

  it('extracts the feeling select color when present', () => {
    const page: NotionPage = {
      id: 'p',
      properties: {
        Feeling: { type: 'select', select: { name: '(^^)', color: 'green' } },
      },
    };
    expect(notionPageToSnapshot(page, '', '2026-05-24').feelingColor).toBe('green');
  });

  it('discards color when the feeling name is unknown', () => {
    const page: NotionPage = {
      id: 'p',
      properties: {
        Feeling: { type: 'select', select: { name: 'invalid', color: 'red' } },
      },
    };
    expect(notionPageToSnapshot(page, '', '2026-05-24').feelingColor).toBeNull();
  });

  it('extracts emoji / external / file page icons', () => {
    const emoji: NotionPage = {
      id: 'a',
      properties: {},
      icon: { type: 'emoji', emoji: '🌱' },
    };
    expect(notionPageToSnapshot(emoji, '', '2026-05-24').icon).toEqual({
      type: 'emoji',
      emoji: '🌱',
    });

    const external: NotionPage = {
      id: 'b',
      properties: {},
      icon: { type: 'external', external: { url: 'https://example.com/i.png' } },
    };
    expect(notionPageToSnapshot(external, '', '2026-05-24').icon).toEqual({
      type: 'external',
      url: 'https://example.com/i.png',
    });

    const file: NotionPage = {
      id: 'c',
      properties: {},
      icon: { type: 'file', file: { url: 'https://notion-files/i.png' } },
    };
    expect(notionPageToSnapshot(file, '', '2026-05-24').icon).toEqual({
      type: 'external',
      url: 'https://notion-files/i.png',
    });

    const none: NotionPage = { id: 'd', properties: {} };
    expect(notionPageToSnapshot(none, '', '2026-05-24').icon).toBeNull();
  });

  it('extracts cover URL from external / file / file_upload variants', () => {
    const ext: NotionPage = {
      id: 'a',
      properties: {},
      cover: { type: 'external', external: { url: 'https://example.com/a.jpg' } },
    };
    expect(notionPageToSnapshot(ext, '', '2026-05-24').coverUrl).toBe('https://example.com/a.jpg');

    const file: NotionPage = {
      id: 'b',
      properties: {},
      cover: { type: 'file', file: { url: 'https://notion-files/b.jpg' } },
    };
    expect(notionPageToSnapshot(file, '', '2026-05-24').coverUrl).toBe('https://notion-files/b.jpg');

    const upload: NotionPage = {
      id: 'c',
      properties: {},
      cover: { type: 'file_upload', file_upload: { id: 'fu-1', url: 'https://notion-files/c.jpg' } },
    };
    expect(notionPageToSnapshot(upload, '', '2026-05-24').coverUrl).toBe('https://notion-files/c.jpg');

    const none: NotionPage = { id: 'd', properties: {} };
    expect(notionPageToSnapshot(none, '', '2026-05-24').coverUrl).toBeNull();
  });
});

describe('snapshotToNotionUpdate', () => {
  it('builds property payload matching the Notion API shape', () => {
    const snap = emptySnapshot('2026-05-24');
    snap.feeling = '(TT)';
    snap.diary = 'hello';
    snap.habits.exercise = true;
    const update = snapshotToNotionUpdate(snap);
    expect(update.properties.Feeling).toEqual({ select: { name: '(TT)' } });
    expect(update.properties.Diary).toEqual({ rich_text: [{ text: { content: 'hello' } }] });
    expect(update.properties.Exercise).toEqual({ checkbox: true });
  });

  it('clears feeling with `select: null` when not chosen', () => {
    const update = snapshotToNotionUpdate(emptySnapshot('2026-05-24'));
    expect(update.properties.Feeling).toEqual({ select: null });
  });

  it('omits Tracked because it is Toggl-managed (read-only)', () => {
    const snap = emptySnapshot('2026-05-24');
    snap.tracked = '6h work';
    const update = snapshotToNotionUpdate(snap);
    expect(update.properties.Tracked).toBeUndefined();
  });

  it('omits properties the DB no longer has (Plus/Minus/Highlight/Next/Sleep)', () => {
    const update = snapshotToNotionUpdate(emptySnapshot('2026-05-24'));
    expect(update.properties.Plus).toBeUndefined();
    expect(update.properties.Minus).toBeUndefined();
    expect(update.properties.Highlight).toBeUndefined();
    expect(update.properties.Next).toBeUndefined();
    expect(update.properties.Sleep).toBeUndefined();
  });

  it('emits empty rich_text for a blank diary rather than dropping it', () => {
    const update = snapshotToNotionUpdate(emptySnapshot('2026-05-24'));
    expect(update.properties.Diary).toEqual({ rich_text: [] });
  });
});
