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
 * the real access control is the table's Row Level Security setting,
 * not the key's secrecy.
 */

import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project details.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // This app never signs anyone in - it just reads/writes a public
    // table with the publishable key - so there's no session to
    // persist or refresh.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});