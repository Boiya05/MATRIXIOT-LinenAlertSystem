/**
 * lib/supabase.ts
 *
 * The connected Supabase client, shared by every page in this
 * dashboard. This talks to the exact same project and tables as the
 * desktop app (linen_detection_system) and the mobile app
 * (linen-mobile-app-v2), so all three show the same live data.
 *
 * Like the mobile app, this uses Supabase's "publishable" key, which
 * is designed to be embedded in client apps - for the shared
 * linen_items/theft_alerts tables, the real access control is each
 * table's Row Level Security policy (requires a logged-in session),
 * not the key's secrecy. The browser Supabase client handles session
 * storage (localStorage) and token refresh on its own here - no
 * custom storage adapter needed the way React Native requires one.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_KEY. ' +
      'Copy .env.example to .env.local and fill in your Supabase project details.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
