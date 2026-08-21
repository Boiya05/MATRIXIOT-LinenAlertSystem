/**
 * hooks/use-theme.ts
 *
 * Reads/writes the light-vs-dark preference. The initial `dark` class
 * on <html> is already applied synchronously by the inline script in
 * layout.tsx (before hydration, to avoid a flash of the wrong theme
 * on load) - this hook just mirrors that into React state on mount so
 * the toggle button (components/nav.tsx) knows which icon to show,
 * and handles updating both the class and localStorage when someone
 * clicks it.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'linen-rfid-theme';

type Theme = 'light' | 'dark';

export function useTheme() {
  // Starts 'light' to match server-side rendering (there's no DOM to
  // read yet); corrected to whatever layout.tsx's script actually
  // applied the moment this mounts, in the effect below.
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled - the toggle still works
      // for the rest of this page load, it just won't be remembered.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
