/**
 * hooks/use-auth-deep-link.ts
 *
 * Handles the incoming link from a Supabase password-reset email
 * (linenmobileappv2://reset-password#access_token=...&type=recovery
 * or ...?code=...). The Supabase client has detectSessionInUrl set to
 * false (that option is a web-only concept - there's no browser URL
 * bar on a phone to read from), so establishing the session from a
 * deep link here is done by hand instead of automatically.
 *
 * Mounted once at the root layout. Once the session is set, auth
 * state changes to PASSWORD_RECOVERY (see contexts/auth-context.tsx),
 * which routes to the reset-password screen - this hook's only job is
 * getting a session out of the link, not deciding what screen to show.
 *
 * Handles both token shapes Supabase's email templates can produce:
 * a URL fragment with access_token/refresh_token (the older "implicit"
 * flow), or a query param with a single-use `code` (the newer PKCE
 * flow) - which one arrives depends on the Supabase project's auth
 * settings, not something this app controls, so both are handled
 * rather than assuming one.
 */

import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

function extractParams(url: string): URLSearchParams {
  // The token data can be after a `#` (fragment) or a `?` (query) -
  // some Android versions also flatten a fragment into an extra `?`
  // segment, so check both rather than assuming which one a given
  // link uses.
  const fragmentIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramString =
    fragmentIndex !== -1 ? url.slice(fragmentIndex + 1) : queryIndex !== -1 ? url.slice(queryIndex + 1) : '';
  return new URLSearchParams(paramString);
}

async function handleIncomingUrl(url: string | null) {
  if (!url || !url.includes('reset-password')) return;

  const params = extractParams(url);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const code = params.get('code');

  try {
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) console.warn('Failed to establish session from reset link:', error.message);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.warn('Failed to exchange reset code for a session:', error.message);
    } else {
      console.warn('Reset-password link opened, but no recognizable token/code was found in it.');
    }
  } catch (err) {
    console.warn('Failed to handle password-reset deep link:', err);
  }
}

export function useAuthDeepLink() {
  useEffect(() => {
    // The app might have been launched fresh by tapping the email
    // link (cold start) ...
    Linking.getInitialURL().then(handleIncomingUrl);

    // ... or already running in the background when the link is
    // tapped (warm start) - both need handling.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
