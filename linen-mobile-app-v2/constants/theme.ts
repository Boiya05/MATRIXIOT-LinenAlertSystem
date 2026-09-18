/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Ported from the web dashboard's actual Tailwind palette
// (linen-web-dashboard/app/globals.css + its component classes), so
// both apps read as the same product - teal accent, slate neutrals,
// amber/red for warning/danger. Replaces the original Expo template's
// blue/violet defaults.
const tintColorLight = '#0d9488'; // teal-600
const tintColorDark = '#2dd4bf'; // teal-400

export const Colors = {
  light: {
    text: '#0f172a', // slate-900
    background: '#f8fafc', // slate-50
    tint: tintColorLight,
    icon: '#64748b', // slate-500
    tabIconDefault: '#64748b',
    tabIconSelected: tintColorLight,
    cardBackground: '#ffffff',
    border: '#e2e8f0', // slate-200
    textSecondary: '#94a3b8', // slate-400
    // Status semantics used across the app - keep separate from `tint`,
    // which is just the brand accent color. Matches the web dashboard's
    // stat chips exactly: teal for In Use, amber for Laundry, slate for
    // Storage/Total (not its own hue - "not currently with a guest"
    // isn't a warning state).
    statusInUse: '#0d9488', // teal-600
    statusLaundry: '#d97706', // amber-600
    statusStorage: '#94a3b8', // slate-400
    danger: '#dc2626', // red-600
    dangerBackground: '#fef2f2', // red-50
    warningText: '#b45309', // amber-700
    warningBackground: '#fffbeb', // amber-50
    // Scanner Mode colors, matching the desktop app's mode buttons /
    // the web dashboard's "Desktop scanner" status badge - Exit
    // Scanner mode reuses `danger` (red), so only these two are new.
    modeRegister: '#3b82f6', // blue-500
    modeAssign: '#a855f7', // purple-500
  },
  dark: {
    text: '#e2e8f0', // slate-200, matches web's dark --foreground
    background: '#0a0f1a', // matches web's dark --background
    tint: tintColorDark,
    icon: '#94a3b8', // slate-400
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorDark,
    cardBackground: '#0f172a', // slate-900
    border: '#1e293b', // slate-800
    textSecondary: '#64748b', // slate-500
    statusInUse: '#2dd4bf', // teal-400
    statusLaundry: '#fbbf24', // amber-400
    statusStorage: '#64748b', // slate-500
    danger: '#f87171', // red-400
    dangerBackground: '#3b1416',
    warningText: '#fbbf24', // amber-400
    warningBackground: '#3d2e0f',
    modeRegister: '#60a5fa', // blue-400
    modeAssign: '#c084fc', // purple-400
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
