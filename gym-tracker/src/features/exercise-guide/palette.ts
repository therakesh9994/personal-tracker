import { colors } from '@/theme';

/** Anatomy palette: neutral body, muscles a shade lighter, worked muscles in the accent colour. */
export const ANATOMY = {
  skin: '#434C46',
  skinFar: '#2E3531',
  muscle: '#5E6862',
  primary: colors.accent,
  secondary: '#6F8F2E',
  primaryFar: '#7FA82A',
  secondaryFar: '#4A5F23',
  outline: 'rgba(9,11,10,0.55)',
} as const;
