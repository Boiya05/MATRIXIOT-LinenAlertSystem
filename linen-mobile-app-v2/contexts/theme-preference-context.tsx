/**
 * contexts/theme-preference-context.tsx
 *
 * Lets people override the app's light/dark appearance from Settings
 * instead of always following the OS setting. The choice is stored
 * on-device (AsyncStorage) - it's a display preference tied to this
 * install, not account data, so it isn't synced through Supabase the
 * way the notification toggles in data/user-settings.ts are.
 *
 * hooks/use-color-scheme.ts reads from this context, so every screen
 * that already calls useColorScheme() picks up the override for free.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemePreferenceContextValue {
  /** What the user picked in Settings - 'system' means "follow the OS". */
  themePreference: ThemePreference;
  /** The actual scheme to render, with 'system' already resolved. */
  colorScheme: 'light' | 'dark';
  setThemePreference: (preference: ThemePreference) => void;
}

const STORAGE_KEY = 'theme-preference';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  // Load any previously saved override once on launch. Starting from
  // 'system' before this resolves just means the app briefly follows
  // the OS scheme, same as before this feature existed - never a
  // flash of the wrong *explicit* choice.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemePreferenceState(stored);
      }
    });
  }, []);

  const setThemePreference = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    AsyncStorage.setItem(STORAGE_KEY, preference).catch((err) => {
      console.warn('Failed to save theme preference:', err);
    });
  };

  const colorScheme: 'light' | 'dark' =
    themePreference === 'system' ? (systemScheme ?? 'light') : themePreference;

  const value = useMemo(
    () => ({ themePreference, colorScheme, setThemePreference }),
    [themePreference, colorScheme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return context;
}
