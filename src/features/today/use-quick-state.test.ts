import { describe, expect, it } from '@jest/globals';

import { toggledHabits } from './use-quick-state';

describe('toggledHabits', () => {
  const base = { output: false, book: true, design: false, english: false, exercise: false };

  it('flips only the requested habit', () => {
    const next = toggledHabits(base, 'output');
    expect(next.output).toBe(true);
    expect(next.book).toBe(true);
    expect(next.design).toBe(false);
  });

  it('turns a checked habit back off', () => {
    expect(toggledHabits(base, 'book').book).toBe(false);
  });

  it('does not mutate the input', () => {
    toggledHabits(base, 'output');
    expect(base.output).toBe(false);
  });
});
