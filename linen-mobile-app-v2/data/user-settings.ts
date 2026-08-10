/**
 * user-settings.ts
 *
 * Per-account settings (currently: the two notification toggles),
 * stored in Supabase's user_settings table so they follow you across
 * devices and reinstalls instead of resetting every time. Row Level
 * Security on that table means each account can only ever read or
 * write its own row - see the SQL in the mobile app's README.
 */

import { supabase } from '@/lib/supabase';

export interface UserSettings {
  alertsEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  alertsEnabled: true,
  soundEnabled: true,
};

/**
 * Loads the signed-in user's settings. If this is their first time
 * (no row yet), creates one with the defaults and returns that.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load settings: ${error.message}`);
  }

  if (!data) {
    await saveUserSettings(userId, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  return {
    alertsEnabled: data.alerts_enabled,
    soundEnabled: data.sound_enabled,
  };
}

/** Saves (creates or updates) the signed-in user's settings. */
export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      alerts_enabled: settings.alertsEnabled,
      sound_enabled: settings.soundEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}
