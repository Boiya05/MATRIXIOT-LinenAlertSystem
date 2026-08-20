/**
 * lib/supabase.ts
 *
 * The connected Supabase client, shared by every function in
 * data/linen-data.ts. This talks to the exact same project and table
 * as the desktop app's database.py, so both apps see the same data.
 *
 * The URL and key come from .env (EXPO_PUBLIC_* variables are inlined
 * into the app at build time by Expo). See .env.example for the
 * expected format. Like the desktop app, this uses Supabase's
 * "publishable" key, which is designed to be embedded in client apps -
 * for the shared linen_items/theft_alerts tables, the real access
 * control is the table's Row Level Security setting, not the key's
 * secrecy. For user_settings (per-account data), RLS policies tied to
 * the logged-in user's session are what keep one person's settings
 * private from another's.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project details.'
  );
}

// On web, `expo export`/`expo start` prerender every route once in Node
// (for the static HTML shell) before any browser exists. AsyncStorage's
// web implementation reads `window.localStorage` unconditionally, which
// throws "window is not defined" during that pass and crashes the whole
// export. Native platforms never hit this (there's no server-render
// step), so only the web branch needs the `typeof window` guard - it
// just no-ops during prerendering and behaves exactly like AsyncStorage
// once real browser JS takes over.
//
// Also guards each call against localStorage itself throwing (Safari
// private browsing, storage blocked by an extension/policy, or a quota
// error) - without this, a thrown SecurityError would propagate straight
// into Supabase auth's session bootstrap instead of just leaving that
// one read/write as a no-op.
const webStorage: SupportedStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    try {
      return Promise.resolve(window.localStorage.getItem(key));
    } catch (err) {
      console.warn('Failed to read from localStorage:', err);
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        console.warn('Failed to write to localStorage:', err);
      }
    }
    return Promise.resolve();
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        console.warn('Failed to remove from localStorage:', err);
      }
    }
    return Promise.resolve();
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Sessions need to persist across app restarts (so you're not
    // asked to log in every time) and refresh themselves in the
    // background. AsyncStorage is React Native's on-device storage -
    // Supabase's JS client needs an explicit adapter for it, since
    // browser localStorage isn't available here.
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
