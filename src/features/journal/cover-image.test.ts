import { describe, expect, it } from '@jest/globals';

import { coverImageSource } from './cover-image';

describe('coverImageSource', () => {
  it('uses the URL path as cacheKey, dropping the volatile signed query', () => {
    const a = coverImageSource(
      'https://s3.example.com/bucket/photo.jpg?X-Amz-Signature=aaa&X-Amz-Expires=3600',
    );
    const b = coverImageSource(
      'https://s3.example.com/bucket/photo.jpg?X-Amz-Signature=bbb&X-Amz-Expires=7200',
    );
    expect(a.cacheKey).toBe('https://s3.example.com/bucket/photo.jpg');
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.uri).toContain('X-Amz-Signature=aaa');
  });

  it('keeps distinct files on distinct cacheKeys', () => {
    const a = coverImageSource('https://s3.example.com/bucket/a.jpg?sig=1');
    const b = coverImageSource('https://s3.example.com/bucket/b.jpg?sig=1');
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('uses the full URL as cacheKey when there is no query', () => {
    expect(coverImageSource('https://example.com/photo.jpg').cacheKey).toBe(
      'https://example.com/photo.jpg',
    );
  });

  it('passes local file URIs through without a cacheKey', () => {
    const source = coverImageSource('file:///tmp/pending.jpg');
    expect(source).toEqual({ uri: 'file:///tmp/pending.jpg' });
  });
});
