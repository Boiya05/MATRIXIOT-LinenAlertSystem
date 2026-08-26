/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    cardBackground: '#F5F7FA',
    border: '#E1E5EA',
    textSecondary: '#5B6470',
    // Status semantics used across the app - keep separate from `tint`,
    // which is just the brand accent color. Each status gets its own hue
    // (green/amber/violet) so the stat grid, room icons, and category
    // rows are easy to tell apart at a glance.
    statusInUse: '#16A34A',
    statusLaundry: '#D97706',
    statusStorage: '#7C3AED',
    danger: '#DC2626',
    dangerBackground: '#FEE2E2',
    warningText: '#92400E',
    warningBackground: '#FFFBEB',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    cardBackground: '#1E2124',
    border: '#2A2D30',
    textSecondary: '#9BA1A6',
    statusInUse: '#4ADE80',
    statusLaundry: '#F0A93E',
    statusStorage: '#A78BFA',
    danger: '#F87171',
    dangerBackground: '#3B1D1D',
    warningText: '#FBBF24',
    warningBackground: '#3D2E0F',
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
