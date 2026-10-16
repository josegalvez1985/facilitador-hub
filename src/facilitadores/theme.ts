// Paleta del diseño original (convertida de oklch a hex).
export const colors = {
  background: '#f7f9fc',
  foreground: '#212936',
  card: '#ffffff',
  primary: '#2663eb',
  primaryForeground: '#ffffff',
  secondary: '#e4eefd',
  muted: '#edf1f6',
  mutedForeground: '#6a727d',
  border: '#e2e7ec',
  destructive: '#db4241',
  teal: '#009784',
  tealSoft: '#d9f8ee',
  amber: '#d38e22',
  amberSoft: '#fff6dd',
  heroTint: '#ddf0fa',
  overlay: 'rgba(16, 23, 31, 0.4)',
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fonts;
export type Tone = 'primary' | 'teal' | 'amber';

export const tones: Record<Tone, { color: string; background: string }> = {
  primary: { color: colors.primary, background: colors.secondary },
  teal: { color: colors.teal, background: colors.tealSoft },
  amber: { color: colors.amber, background: colors.amberSoft },
};

export const radius = { sm: 4, md: 6, lg: 8 } as const;

export const shadow = { boxShadow: '0 4px 20px rgba(33, 41, 54, 0.04)' } as const;

// Mismos puntos de quiebre que la versión web: < 800 móvil, < 1100 escritorio compacto.
export const breakpoints = { desktop: 800, wide: 1100 } as const;
