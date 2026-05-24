import { describe, expect, it } from '@jest/globals';

import { notionChipColor } from './colors';

describe('notionChipColor', () => {
  it('maps a known color in light mode', () => {
    const { background, text } = notionChipColor('green', 'light');
    expect(background).toMatch(/^#[0-9A-F]{6}$/i);
    expect(text).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('returns different palettes for light vs dark', () => {
    const light = notionChipColor('blue', 'light');
    const dark = notionChipColor('blue', 'dark');
    expect(light.background).not.toBe(dark.background);
  });

  it('falls back to default for null/undefined', () => {
    const fallback = notionChipColor(null, 'light');
    const explicit = notionChipColor('default', 'light');
    expect(fallback).toEqual(explicit);
    expect(notionChipColor(undefined, 'dark')).toEqual(
      notionChipColor('default', 'dark'),
    );
  });
});
