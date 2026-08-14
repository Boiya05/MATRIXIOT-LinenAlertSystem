import { useEffect, useState } from 'react';

import { useThemePreference } from '@/contexts/theme-preference-context';

/**
 * To support static rendering, this value needs to be re-calculated on
 * the client side for web. Once hydrated, resolves to 'light' | 'dark',
 * honoring a user override from Settings (theme-preference-context.tsx)
 * and falling back to the OS setting.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const { colorScheme } = useThemePreference();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
