/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

/**
 * Warm, gentle palette: off-white paper tones in light mode, warm charcoal
 * in dark mode. `accent` is a soft terracotta used sparingly (today marker,
 * primary buttons); `accentSoft` is its background-strength counterpart.
 * `holiday` / `saturday` keep the Japanese calendar convention (red Sun/
 * holiday, blue Sat) but desaturated so the grid stays calm.
 */
export const Colors = {
  light: {
    text: '#3B342B',
    background: '#FBF8F3',
    backgroundElement: '#F2EDE5',
    backgroundSelected: '#E8E0D2',
    textSecondary: '#8B8272',
    accent: '#C67B5C',
    accentSoft: '#F6E3D9',
    danger: '#C05F5F',
    holiday: '#C67878',
    saturday: '#7B93B5',
  },
  dark: {
    text: '#EDE6DA',
    background: '#181512',
    backgroundElement: '#25211B',
    backgroundSelected: '#332D24',
    textSecondary: '#A89E8C',
    accent: '#D99070',
    accentSoft: '#3C2E25',
    danger: '#D98A8A',
    holiday: '#D99090',
    saturday: '#93A8C8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii. Cards default to `lg`; small chips/thumbnails use `sm`/`md`. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

// Clearance for the floating glass tab pill (52pt) + its bottom offset.
export const BottomTabInset = Platform.select({ ios: 64, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
