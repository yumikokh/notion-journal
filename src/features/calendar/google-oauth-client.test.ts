import { describe, expect, it } from '@jest/globals';

import { parseGoogleOAuthCallback } from './google-oauth-client';

describe('parseGoogleOAuthCallback', () => {
  const STATE = 'abc123';

  it('extracts code when state matches', () => {
    const { code } = parseGoogleOAuthCallback(
      `notion-journal://google-oauth?code=xyz&state=${STATE}`,
      STATE,
    );
    expect(code).toBe('xyz');
  });

  it('throws when error param is present (consent denied)', () => {
    expect(() =>
      parseGoogleOAuthCallback(
        `notion-journal://google-oauth?error=access_denied&state=${STATE}`,
        STATE,
      ),
    ).toThrow(/access_denied/);
  });

  it('throws on state mismatch even when code is present (CSRF guard)', () => {
    expect(() =>
      parseGoogleOAuthCallback(
        'notion-journal://google-oauth?code=xyz&state=tampered',
        STATE,
      ),
    ).toThrow(/state mismatch/);
  });

  it('throws when state is missing', () => {
    expect(() =>
      parseGoogleOAuthCallback('notion-journal://google-oauth?code=xyz', STATE),
    ).toThrow(/state mismatch/);
  });

  it('throws when code is missing but state matches', () => {
    expect(() =>
      parseGoogleOAuthCallback(
        `notion-journal://google-oauth?state=${STATE}`,
        STATE,
      ),
    ).toThrow(/missing code/);
  });

  it('prefers error over the missing-code path when both apply', () => {
    expect(() =>
      parseGoogleOAuthCallback(
        `notion-journal://google-oauth?error=server_error&state=${STATE}`,
        STATE,
      ),
    ).toThrow(/server_error/);
  });
});
