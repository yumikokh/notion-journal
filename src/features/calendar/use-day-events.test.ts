import { describe, expect, it } from '@jest/globals';

import { buildDayRangeIso } from './use-day-events';

describe('buildDayRangeIso', () => {
  it('returns a one-day local window for a YYYY-MM-DD key', () => {
    const { timeMin, timeMax } = buildDayRangeIso('2026-06-05');
    // ISO strings are UTC; the local-day window converts to whatever
    // 24-hour UTC span this machine sits on. We assert the gap, not
    // the exact UTC instants, so the test is timezone-portable.
    const dMin = new Date(timeMin).getTime();
    const dMax = new Date(timeMax).getTime();
    expect(dMax - dMin).toBe(24 * 60 * 60 * 1000);
  });

  it('start is at midnight local time', () => {
    const { timeMin } = buildDayRangeIso('2026-06-05');
    const d = new Date(timeMin);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('handles end-of-month rollover (2026-02-28 → 2026-03-01)', () => {
    const { timeMin, timeMax } = buildDayRangeIso('2026-02-28');
    const start = new Date(timeMin);
    const end = new Date(timeMax);
    expect(start.getDate()).toBe(28);
    expect(start.getMonth()).toBe(1); // Feb
    expect(end.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2); // Mar
  });

  it('handles year boundary (2026-12-31 → 2027-01-01)', () => {
    const { timeMax } = buildDayRangeIso('2026-12-31');
    const end = new Date(timeMax);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(1);
  });
});
