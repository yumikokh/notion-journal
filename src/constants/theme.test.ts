import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PALETTE, Palettes, parsePaletteKey } from './theme';

describe('parsePaletteKey', () => {
  it('returns a stored valid key as-is', () => {
    expect(parsePaletteKey('cream')).toBe('cream');
    expect(parsePaletteKey('coolGray')).toBe('coolGray');
    expect(parsePaletteKey('terracotta')).toBe('terracotta');
  });

  it('falls back to the default for null / unknown values', () => {
    expect(parsePaletteKey(null)).toBe(DEFAULT_PALETTE);
    expect(parsePaletteKey(undefined)).toBe(DEFAULT_PALETTE);
    expect(parsePaletteKey('')).toBe(DEFAULT_PALETTE);
    expect(parsePaletteKey('__removed_palette__')).toBe(DEFAULT_PALETTE);
  });

  it('every palette provides the full token set for both schemes', () => {
    const requiredKeys = Object.keys(Palettes[DEFAULT_PALETTE].light).sort();
    for (const palette of Object.values(Palettes)) {
      expect(Object.keys(palette.light).sort()).toEqual(requiredKeys);
      expect(Object.keys(palette.dark).sort()).toEqual(requiredKeys);
    }
  });
});
