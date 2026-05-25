import { describe, expect, it } from '@jest/globals';
import type { Query, QueryKey } from '@tanstack/react-query';

import { shouldPersistQuery } from './query-client';

function fakeQuery(queryKey: QueryKey): Query {
  return { queryKey } as Query;
}

describe('shouldPersistQuery', () => {
  it('persists today journal entries so cold start hydrates instantly', () => {
    expect(shouldPersistQuery(fakeQuery(['journal', 'today', '2026-05-25']))).toBe(true);
  });

  it('persists monthly journal aggregates for the calendar screen', () => {
    expect(shouldPersistQuery(fakeQuery(['journal', 'month', '2026-05']))).toBe(true);
  });

  it('skips weekly AI analysis — payload is large and regeneratable', () => {
    expect(shouldPersistQuery(fakeQuery(['weekly-analysis', '2026-05-18', '2026-05-24']))).toBe(
      false,
    );
  });

  it('skips unknown roots by default so new queries opt in explicitly', () => {
    expect(shouldPersistQuery(fakeQuery(['calendar-events', '2026-05']))).toBe(false);
  });
});
