import { describe, expect, it } from '@jest/globals';

import { buildLogLine, formatTimeLabel, parseTodayLogs } from './today-log';

describe('formatTimeLabel', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatTimeLabel(new Date(2026, 6, 6, 9, 5))).toBe('09:05');
    expect(formatTimeLabel(new Date(2026, 6, 6, 23, 59))).toBe('23:59');
  });
});

describe('buildLogLine', () => {
  it('builds the bold time marker line', () => {
    expect(buildLogLine('12:34', ' ランチにカレー ')).toBe('**12:34** ランチにカレー');
  });
});

describe('parseTodayLogs', () => {
  it('parses appended log paragraphs in order', () => {
    const body = ['**09:12** 朝のコーヒー', '', '**12:34** ランチにカレー'].join('\n');
    expect(parseTodayLogs(body)).toEqual([
      { time: '09:12', text: '朝のコーヒー' },
      { time: '12:34', text: 'ランチにカレー' },
    ]);
  });

  it('keeps multi-line fragments together', () => {
    const body = ['**21:00** 今日の気付き', '続きの行', '', '**22:00** 就寝前'].join('\n');
    expect(parseTodayLogs(body)).toEqual([
      { time: '21:00', text: '今日の気付き\n続きの行' },
      { time: '22:00', text: '就寝前' },
    ]);
  });

  it('ignores body content that is not a captured log', () => {
    const body = [
      '# 今日のメモ',
      'ドロワーで書いた自由記述。',
      '',
      '**18:30** 夕方のログ',
    ].join('\n');
    expect(parseTodayLogs(body)).toEqual([{ time: '18:30', text: '夕方のログ' }]);
  });

  it('returns empty for an empty body', () => {
    expect(parseTodayLogs('')).toEqual([]);
  });
});
