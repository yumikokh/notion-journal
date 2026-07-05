import { describe, expect, it } from '@jest/globals';

import { computeCropRect, coverBaseScale } from './cover-crop';

describe('coverBaseScale', () => {
  it('covers the frame with the smaller image dimension', () => {
    // 4000x3000 landscape into a 320x180 frame: width-limited side is
    // height (180/3000 = 0.06 > 320/4000 = 0.08? no — max wins).
    expect(coverBaseScale(4000, 3000, 320, 180)).toBeCloseTo(0.08);
    // Tall portrait: width must stretch to cover.
    expect(coverBaseScale(1000, 4000, 320, 180)).toBeCloseTo(0.32);
  });
});

describe('computeCropRect', () => {
  const frame = { frameWidth: 320, frameHeight: 180 };

  it('crops the full 16:9 band at zoom 1 with no offset', () => {
    const rect = computeCropRect({
      imageWidth: 3200,
      imageHeight: 1800,
      ...frame,
      zoomScale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(rect).toEqual({ originX: 0, originY: 0, width: 3200, height: 1800 });
  });

  it('offsets select the panned area (a 4:3 photo panned down)', () => {
    // 4000x3000 → base scale 0.1 (width fits 400pt? frame 320 → 0.08; height
    // 180/3000=0.06 → cover = 0.08). Displayed 320x240, offsetY up to 60.
    const rect = computeCropRect({
      imageWidth: 4000,
      imageHeight: 3000,
      ...frame,
      zoomScale: 1,
      offsetX: 0,
      offsetY: 60,
    });
    expect(rect.originY).toBe(750); // 60 / 0.08
    expect(rect.height).toBe(2250); // 180 / 0.08
    expect(rect.originY + rect.height).toBeLessThanOrEqual(3000);
  });

  it('zooming narrows the crop to the visible viewport', () => {
    const rect = computeCropRect({
      imageWidth: 3200,
      imageHeight: 1800,
      ...frame,
      zoomScale: 2,
      offsetX: 320,
      offsetY: 180,
    });
    // scale = 0.1 * 2 = 0.2 → viewport 1600x900 at (1600, 900)
    expect(rect).toEqual({ originX: 1600, originY: 900, width: 1600, height: 900 });
  });

  it('clamps rounding overflow at the image edges', () => {
    const rect = computeCropRect({
      imageWidth: 1013,
      imageHeight: 570,
      ...frame,
      zoomScale: 1,
      offsetX: 9999,
      offsetY: 9999,
    });
    expect(rect.originX + rect.width).toBeLessThanOrEqual(1013);
    expect(rect.originY + rect.height).toBeLessThanOrEqual(570);
    expect(rect.originX).toBeGreaterThanOrEqual(0);
    expect(rect.originY).toBeGreaterThanOrEqual(0);
  });
});
