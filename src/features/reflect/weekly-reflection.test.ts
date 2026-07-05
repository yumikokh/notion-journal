import { describe, expect, it } from '@jest/globals';

import type { NotionPage } from '@/features/notion/types';

import {
  REFLECTION_PROPERTY_NAMES,
  emptyWeeklyReflection,
  hasSavedReflection,
  notionPageToWeeklyReflection,
  reflectionToNotionUpdate,
  type WeeklyReflection,
} from './weekly-reflection';

const P = REFLECTION_PROPERTY_NAMES;

function richText(text: string) {
  return {
    type: 'rich_text' as const,
    rich_text: text ? [{ plain_text: text }] : [],
  };
}

const samplePage: NotionPage = {
  id: 'page-week-1',
  properties: {
    [P.name]: { type: 'title', title: [{ plain_text: '5/26 - 6/1' }] },
    [P.date]: { type: 'date', date: { start: '2026-06-01' } },
    [P.type]: { type: 'select', select: { name: 'Weekly' } },
    [P.good]: richText('集中できた'),
    [P.problem]: richText('夜更かしが続いた'),
    [P.tryNext]: richText('22時就寝'),
    [P.nextGoal]: richText('運動を週3回'),
  },
};

describe('notionPageToWeeklyReflection', () => {
  it('returns an empty reflection when the page is null', () => {
    const r = notionPageToWeeklyReflection(null, '2026-05-26', '2026-06-01');
    expect(r).toEqual(emptyWeeklyReflection('2026-05-26', '2026-06-01'));
    expect(r.notionPageId).toBeNull();
  });

  it('maps the four reflection fields + date from Notion', () => {
    const r = notionPageToWeeklyReflection(samplePage, '2026-05-26', '2026-06-01');
    expect(r).toMatchObject({
      notionPageId: 'page-week-1',
      weekStart: '2026-05-26',
      weekEnd: '2026-06-01',
      date: '2026-06-01',
      good: '集中できた',
      problem: '夜更かしが続いた',
      tryNext: '22時就寝',
      nextGoal: '運動を週3回',
    });
  });

  it('reads empty strings for missing rich_text props and null date', () => {
    const page: NotionPage = { id: 'p', properties: {} };
    const r = notionPageToWeeklyReflection(page, '2026-05-26', '2026-06-01');
    expect(r.good).toBe('');
    expect(r.problem).toBe('');
    expect(r.tryNext).toBe('');
    expect(r.nextGoal).toBe('');
    expect(r.date).toBeNull();
  });

  it('treats a cleared (empty array) rich_text prop as an empty string', () => {
    const page: NotionPage = {
      id: 'p',
      properties: { [P.good]: richText('') },
    };
    expect(notionPageToWeeklyReflection(page, '2026-05-26', '2026-06-01').good).toBe('');
  });
});

describe('reflectionToNotionUpdate', () => {
  const base: WeeklyReflection = {
    notionPageId: 'page-week-1',
    weekStart: '2026-05-26',
    weekEnd: '2026-06-01',
    date: '2026-06-01',
    good: 'よかった',
    problem: 'だめだった',
    tryNext: 'ためすこと',
    nextGoal: '次の目標',
    bodyMarkdown: '## サマリー\n本文',
  };

  it('builds rich_text payloads keyed by the Japanese property names', () => {
    const { properties } = reflectionToNotionUpdate(base);
    expect(properties[P.good]).toEqual({ rich_text: [{ text: { content: 'よかった' } }] });
    expect(properties[P.problem]).toEqual({ rich_text: [{ text: { content: 'だめだった' } }] });
    expect(properties[P.tryNext]).toEqual({ rich_text: [{ text: { content: 'ためすこと' } }] });
    expect(properties[P.nextGoal]).toEqual({ rich_text: [{ text: { content: '次の目標' } }] });
  });

  it('emits an empty rich_text array for a blank field (clears the cell)', () => {
    const { properties } = reflectionToNotionUpdate({ ...base, good: '' });
    expect(properties[P.good]).toEqual({ rich_text: [] });
  });

  it('does not write Name/Date/Type — the server owns page identity', () => {
    const { properties } = reflectionToNotionUpdate(base);
    expect(properties).not.toHaveProperty(P.name);
    expect(properties).not.toHaveProperty(P.date);
    expect(properties).not.toHaveProperty(P.type);
  });
});

describe('hasSavedReflection', () => {
  const base: WeeklyReflection = {
    notionPageId: 'page-week-1',
    weekStart: '2026-05-26',
    weekEnd: '2026-06-01',
    date: '2026-06-01',
    good: '',
    problem: '',
    tryNext: '',
    nextGoal: '',
    bodyMarkdown: '',
  };

  it('is false when no Notion page exists', () => {
    expect(hasSavedReflection(emptyWeeklyReflection('2026-05-26', '2026-06-01'))).toBe(false);
  });

  it('is false when a page exists but every field and the body are empty', () => {
    expect(hasSavedReflection(base)).toBe(false);
  });

  it('is true when a page exists with at least one non-empty field', () => {
    expect(hasSavedReflection({ ...base, tryNext: '22時就寝' })).toBe(true);
  });

  it('is true when only the page body is present', () => {
    expect(hasSavedReflection({ ...base, bodyMarkdown: '## サマリー\n…' })).toBe(true);
  });
});

describe('notionPageToWeeklyReflection (body)', () => {
  it('passes the page body markdown through', () => {
    const page: NotionPage = { id: 'p', properties: {} };
    const r = notionPageToWeeklyReflection(page, '2026-05-26', '2026-06-01', '## サマリー\n本文');
    expect(r.bodyMarkdown).toBe('## サマリー\n本文');
  });

  it('defaults bodyMarkdown to empty when omitted', () => {
    const page: NotionPage = { id: 'p', properties: {} };
    expect(notionPageToWeeklyReflection(page, '2026-05-26', '2026-06-01').bodyMarkdown).toBe('');
  });
});
