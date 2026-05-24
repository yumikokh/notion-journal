import { describe, expect, it } from '@jest/globals';

import { addDays, formatJournalTitle, toDateKey } from './date';

describe('toDateKey', () => {
  it('formats a date as zero-padded YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 4, 7))).toBe('2026-05-07');
  });

  it('zero-pads single-digit months', () => {
    expect(toDateKey(new Date(2026, 0, 31))).toBe('2026-01-31');
  });
});

describe('formatJournalTitle', () => {
  it('matches the Notion daily page title format', () => {
    expect(formatJournalTitle(new Date(2026, 4, 7))).toBe('@May 7, 2026');
  });
});

describe('addDays', () => {
  it('moves across month boundaries in both directions', () => {
    expect(toDateKey(addDays(new Date(2026, 4, 1), -1))).toBe('2026-04-30');
    expect(toDateKey(addDays(new Date(2026, 4, 31), 1))).toBe('2026-06-01');
  });

  it('does not mutate the input date', () => {
    const original = new Date(2026, 4, 7);
    addDays(original, 5);
    expect(toDateKey(original)).toBe('2026-05-07');
  });
});
