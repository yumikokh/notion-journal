import {
  AuthRequest,
  CodeChallengeMethod,
  ResponseType,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { getGoogleOAuthClientId, getGoogleOAuthRedirectUri } from '@/lib/env';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
/**
 * Custom-scheme callback the in-app browser closes on.
 *
 * Google only accepts HTTPS redirect URIs for Web clients, so the real
 * redirect_uri points at `google-oauth-redirect` which 302s here.
 * `WebBrowser.openAuthSessionAsync` uses the scheme of this URL to know
 * when to dismiss the auth session.
 */
const APP_CALLBACK = 'notion-journal://google-oauth';

export class GoogleOAuthCancelledError extends Error {
  constructor() {
    super('Google OAuth cancelled by user');
    this.name = 'GoogleOAuthCancelledError';
  }
}

export type GoogleOAuthResult = {
  code: string;
  codeVerifier: string;
  /** The redirect_uri Google saw; must be echoed on token exchange. */
  redirectUri: string;
};

/**
 * Drive a PKCE Google OAuth flow. Returns the authorization code so the
 * caller can ship it to `google-oauth-exchange` — tokens never touch
 * the device.
 */
export async function runGoogleOAuthFlow(): Promise<GoogleOAuthResult> {
  const clientId = getGoogleOAuthClientId();
  const redirectUri = getGoogleOAuthRedirectUri();

  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: SCOPES,
    responseType: ResponseType.Code,
    usePKCE: true,
    codeChallengeMethod: CodeChallengeMethod.S256,
    // `access_type=offline` + `prompt=consent` are required for Google
    // to return a refresh_token on every consent (otherwise only on
    // the very first grant).
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  });

  const authUrl = await request.makeAuthUrlAsync({
    authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
  });

  const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_CALLBACK);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new GoogleOAuthCancelledError();
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error(`Google OAuth failed (${result.type})`);
  }

  const { code } = parseGoogleOAuthCallback(result.url, request.state);
  if (!request.codeVerifier) {
    throw new Error('PKCE code_verifier was not generated');
  }

  return {
    code,
    codeVerifier: request.codeVerifier,
    redirectUri,
  };
}

/**
 * Pure helper for the callback URL → code extraction so it can be
 * tested without spinning up a WebBrowser. Throws on any error path:
 * upstream `error` param, state mismatch (CSRF), or missing code.
 */
export function parseGoogleOAuthCallback(
  callbackUrl: string,
  expectedState: string,
): { code: string } {
  const url = new URL(callbackUrl);
  const error = url.searchParams.get('error');
  if (error) {
    throw new Error(`Google OAuth error: ${error}`);
  }
  const state = url.searchParams.get('state');
  if (state !== expectedState) {
    throw new Error('OAuth state mismatch (possible CSRF)');
  }
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('OAuth callback missing code');
  }
  return { code };
}
