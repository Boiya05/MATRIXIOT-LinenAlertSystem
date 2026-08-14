import { useThemePreference } from '@/contexts/theme-preference-context';

/**
 * Resolves to 'light' | 'dark', honoring a user override from Settings
 * (theme-preference-context.tsx) and falling back to the OS setting.
 */
export function useColorScheme() {
  return useThemePreference().colorScheme;
}
