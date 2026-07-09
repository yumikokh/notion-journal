/**
 * Crop-rect math for the 16:9 cover cropper.
 *
 * The cropper is an Instagram-style viewport: a ScrollView sized to the crop
 * frame whose content is the image rendered at "cover" fit for zoom 1
 * (`baseScale` below), zoomable up to MAX_ZOOM. The visible viewport maps
 * back to source-image pixels here.
 */

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type CropViewport = {
  /** Source image size in pixels. */
  imageWidth: number;
  imageHeight: number;
  /** Crop frame size in display points. */
  frameWidth: number;
  frameHeight: number;
  /** ScrollView zoomScale (1 = image cover-fits the frame). */
  zoomScale: number;
  /** ScrollView contentOffset in display points. */
  offsetX: number;
  offsetY: number;
};

/** Scale from image pixels to display points at zoom 1 (cover fit). */
export function coverBaseScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

/**
 * Map the visible viewport back to a source-image crop rect, clamped to the
 * image bounds (rounding at the edges could otherwise push it outside).
 */
export function computeCropRect(viewport: CropViewport): CropRect {
  const { imageWidth, imageHeight, frameWidth, frameHeight, zoomScale, offsetX, offsetY } =
    viewport;
  const scale = coverBaseScale(imageWidth, imageHeight, frameWidth, frameHeight) * zoomScale;

  const width = Math.min(imageWidth, Math.round(frameWidth / scale));
  const height = Math.min(imageHeight, Math.round(frameHeight / scale));
  const originX = Math.min(Math.max(0, Math.round(offsetX / scale)), imageWidth - width);
  const originY = Math.min(Math.max(0, Math.round(offsetY / scale)), imageHeight - height);
  return { originX, originY, width, height };
}
