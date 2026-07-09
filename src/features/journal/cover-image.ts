import type { ImageSource } from 'expo-image';

/**
 * Build an expo-image source for a journal cover URL.
 *
 * Notion-hosted covers are S3 presigned URLs whose query string (signature,
 * expiry) changes on every API response, so the raw URL never matches the
 * image cache — the same photo would re-download on each surface (calendar
 * cell, list card, day drawer). The URL path identifies the underlying file
 * and survives re-signing, so it becomes an explicit `cacheKey`, letting all
 * surfaces share one disk-cache entry. Non-http sources (e.g. `file://`
 * picks pending upload) are returned as-is.
 */
export function coverImageSource(uri: string): ImageSource {
  if (!/^https?:\/\//.test(uri)) return { uri };
  const queryStart = uri.indexOf('?');
  const cacheKey = queryStart === -1 ? uri : uri.slice(0, queryStart);
  return { uri, cacheKey };
}
