import type { TextStyle } from 'react-native';

/** Design tokens — single source for colors, spacing, radius and type. */
export const colors = {
  background: '#090B0A',
  card: '#171B19',
  surface: '#202622',
  accent: '#B6F23A',
  accentMuted: '#354329',
  text: '#F5F7F5',
  textSecondary: '#929B95',
  success: '#65D98B',
  error: '#FF5C5C',
  warning: '#F4B942',
  border: '#292F2B',
  onAccent: '#0B0F06',
  overlay: 'rgba(0,0,0,0.6)',
  // Chart series (high contrast on dark background)
  series: ['#B6F23A', '#65D98B', '#F4B942', '#5CC8FF', '#FF8A5C', '#C792EA'],
} as const;

/** A token colour (#RRGGBB) at the given opacity, e.g. a tinted background behind an icon. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 20, pill: 999 } as const;

/**
 * Font roles. Each weight is its own bundled family (@expo-google-fonts, loaded in the
 * root layout), so styles set fontFamily rather than fontWeight: Android does not map
 * fontWeight onto custom font files.
 */
const FONT_FAMILIES = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
} as const;

/** System-font weights used if the bundled fonts fail to load, keeping the visual hierarchy. */
const FALLBACK_WEIGHTS: Record<FontRole, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  display: '700',
  displayMedium: '600',
};

export type FontRole = keyof typeof FONT_FAMILIES;

let useCustomFonts = true;

/** Call once (before UI renders) when the bundled fonts could not be loaded. */
export function enableSystemFontFallback(): void {
  useCustomFonts = false;
}

/** Text style for a font role. Read at render time so the fallback applies everywhere. */
export function font(role: FontRole): TextStyle {
  return useCustomFonts ? { fontFamily: FONT_FAMILIES[role] } : { fontWeight: FALLBACK_WEIGHTS[role] };
}

const TYPE_SCALE = {
  display: { role: 'display', fontSize: 30, letterSpacing: -0.5 },
  title: { role: 'display', fontSize: 22, letterSpacing: -0.3 },
  heading: { role: 'semibold', fontSize: 17 },
  body: { role: 'regular', fontSize: 15 },
  bodyStrong: { role: 'semibold', fontSize: 15 },
  caption: { role: 'regular', fontSize: 13 },
  label: { role: 'semibold', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  mono: { role: 'semibold', fontSize: 15, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, { role: FontRole } & TextStyle>;

export type TypographyVariant = keyof typeof TYPE_SCALE;
export const TYPOGRAPHY_VARIANTS = Object.keys(TYPE_SCALE) as TypographyVariant[];

/** Full text style for a typography variant (font role resolved at render time). */
export function typographyFor(variant: TypographyVariant): TextStyle {
  const { role, ...rest } = TYPE_SCALE[variant];
  return { ...(rest as TextStyle), ...font(role) };
}

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TOUCH = 44;
