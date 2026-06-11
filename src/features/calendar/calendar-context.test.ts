import { describe, expect, it } from '@jest/globals';

import type { CalendarEvent } from '@/lib/supabase';

import { buildDayCalendarContext } from './calendar-context';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  start: '2026-06-05T00:00:00Z',
  end: '2026-06-05T01:00:00Z',
  summary: 'Event',
  calendarId: 'primary',
  ...over,
});

describe('buildDayCalendarContext', () => {
  it('returns an empty string when there are no events', () => {
    expect(buildDayCalendarContext([])).toBe('');
  });

  it('formats a timed event as a JST HH:MM range', () => {
    // 00:00Z–01:00Z → 09:00–10:00 JST
    const out = buildDayCalendarContext([ev({ summary: '朝会' })]);
    expect(out).toBe('- 09:00–10:00 朝会');
  });

  it('renders all-day events as 終日', () => {
    const out = buildDayCalendarContext([
      ev({ start: '2026-06-05', end: '2026-06-06', summary: '祝日' }),
    ]);
    expect(out).toBe('- 終日 祝日');
  });

  it('appends a trimmed, single-line description', () => {
    const out = buildDayCalendarContext([
      ev({ summary: 'MTG', description: '  議題\n  進捗確認  ' }),
    ]);
    expect(out).toBe('- 09:00–10:00 MTG — 議題 進捗確認');
  });

  it('falls back to (無題) for blank summaries', () => {
    expect(buildDayCalendarContext([ev({ summary: '' })])).toBe('- 09:00–10:00 (無題)');
  });

  it('sorts events chronologically regardless of input order', () => {
    const out = buildDayCalendarContext([
      ev({ start: '2026-06-05T05:00:00Z', end: '2026-06-05T06:00:00Z', summary: '午後' }),
      ev({ start: '2026-06-05T00:00:00Z', end: '2026-06-05T01:00:00Z', summary: '午前' }),
    ]);
    expect(out).toBe('- 09:00–10:00 午前\n- 14:00–15:00 午後');
  });

  it('truncates long descriptions to 120 chars', () => {
    const long = 'あ'.repeat(200);
    const out = buildDayCalendarContext([ev({ summary: 'x', description: long })]);
    expect(out).toContain('— ' + 'あ'.repeat(120));
    expect(out).not.toContain('あ'.repeat(121));
  });
});
