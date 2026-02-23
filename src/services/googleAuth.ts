import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  try {
    // Web: full-page redirect; session is restored via detectSessionInUrl on reload
    if (Platform.OS === 'web') {
      const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
      return { data: null, error: null };
    }

    // Native (iOS / Android): OAuth popup via expo-web-browser
    const redirectUri = 'com.amot.app://auth/callback';

    // On native, auth-js won't auto-redirect (isBrowser() is false), so we always
    // get the URL back regardless of skipBrowserRedirect.
    // We pass skip_http_redirect via queryParams because auth-js does not forward
    // skipBrowserRedirect into the authorize URL.  This tells Supabase to return
    // an HTML meta-refresh page instead of an HTTP 302 for the final redirect.
    // Chrome Custom Tabs handle meta-refresh → custom-scheme navigation reliably,
    // whereas a bare 302 to a custom scheme can stall on some Chrome versions.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
        queryParams: {
          skip_http_redirect: 'true',
        },
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No authorization URL returned');

    console.log('[GoogleAuth] Opening auth session...');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    console.log('[GoogleAuth] Result:', result.type);

    if (result.type === 'success') {
      console.log('[GoogleAuth] Callback URL:', result.url);
      return await _handleCallback(result.url);
    }

    if (result.type === 'dismiss') {
      // Android polyfill returns 'dismiss' when the app comes back to foreground
      // (user pressed back or deep link closed the browser).
      // Check whether a deep link URL arrived that we can still use.
      const initialUrl = await Linking.getInitialURL();
      console.log('[GoogleAuth] Dismiss — checking initialURL:', initialUrl);
      if (initialUrl && initialUrl.startsWith(redirectUri)) {
        return await _handleCallback(initialUrl);
      }

      throw new Error(
        'Google sign-in redirect was not received. ' +
        'If using Expo Go, please build a development client with "npx expo run:android" instead.'
      );
    }

    throw new Error('Google sign-in was cancelled');
  } catch (error) {
    console.error('[GoogleAuth] Error:', error);
    return { data: null, error: error as Error };
  }
}

// Parses the OAuth callback URL and establishes the Supabase session.
// Handles both implicit flow (tokens in hash) and PKCE flow (code in query string).
async function _handleCallback(url: string): Promise<{ data: any; error: any }> {
  console.log('[GoogleAuth] Handling callback URL:', url);

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  // Query string ends at the hash (if present)
  const queryEnd = hashIndex !== -1 ? hashIndex : url.length;
  const queryString = queryIndex !== -1 ? url.substring(queryIndex + 1, queryEnd) : '';
  const hashString = hashIndex !== -1 ? url.substring(hashIndex + 1) : '';

  const queryParams = new URLSearchParams(queryString);
  const hashParams = new URLSearchParams(hashString);

  // PKCE flow: authorization code arrives in the query string
  const code = queryParams.get('code');
  if (code) {
    console.log('[GoogleAuth] Exchanging PKCE authorization code...');
    return await supabase.auth.exchangeCodeForSession(code);
  }

  // Implicit flow: access + refresh tokens arrive in the URL hash
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    console.log('[GoogleAuth] Setting session from implicit-flow tokens...');
    return await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  throw new Error('OAuth callback missing both authorization code and access tokens');
}
