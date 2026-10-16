// Sistema de temas: 6 combinaciones de color × modo claro/oscuro.
// Cada tema define solo 3 colores base; el resto de la paleta se deriva y se ajusta
// para mantener contraste legible (WCAG) en ambos modos.

export type Scheme = 'light' | 'dark';
export type ThemeId = 'clasico' | 'bandera' | 'bosque' | 'atardecer' | 'violeta' | 'oceano';
export type Tone = 'primary' | 'success' | 'accent';

export type Palette = {
  scheme: Scheme;
  background: string;
  foreground: string;
  card: string;
  primary: string; // relleno de botones y elementos destacados
  primaryText: string; // primario usado como texto o ícono sobre superficies
  primaryForeground: string;
  secondary: string; // fondo suave del primario
  muted: string;
  mutedForeground: string;
  border: string;
  destructive: string;
  success: string;
  successSoft: string;
  accent: string;
  accentSoft: string;
  heroTint: string;
  overlay: string;
  shadow: { boxShadow?: string };
};

type ThemeBase = { id: ThemeId; name: string; description: string; primary: string; success: string; accent: string };

export const themes: ThemeBase[] = [
  { id: 'clasico', name: 'Clásico', description: 'Azul educativo', primary: '#2663eb', success: '#009784', accent: '#d38e22' },
  { id: 'bandera', name: 'Bandera', description: 'Juventud con Valores', primary: '#27408b', success: '#3f73c2', accent: '#d62839' },
  { id: 'bosque', name: 'Bosque', description: 'Verde y dorado', primary: '#15803d', success: '#0f766e', accent: '#b7791f' },
  { id: 'atardecer', name: 'Atardecer', description: 'Coral y frambuesa', primary: '#c2410c', success: '#0f766e', accent: '#be185d' },
  { id: 'violeta', name: 'Violeta', description: 'Creatividad', primary: '#7c3aed', success: '#0891b2', accent: '#db2777' },
  { id: 'oceano', name: 'Océano', description: 'Turquesa y arena', primary: '#0e7490', success: '#059669', accent: '#d97706' },
];

export const defaultThemeId: ThemeId = 'clasico';

const neutrals = {
  light: { background: '#f7f9fc', card: '#ffffff', foreground: '#212936', muted: '#edf1f6', mutedForeground: '#5f6874', border: '#e2e7ec' },
  dark: { background: '#0e131a', card: '#171e28', foreground: '#e7ecf3', muted: '#222c38', mutedForeground: '#9aa6b5', border: '#2a3544' },
};

// --- utilidades de color ---
const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** Mezcla `a` con `b`; amount = proporción de `b` (0..1). */
export function mix(a: string, b: string, amount: number) {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + ((y[i] ?? 0) - v) * amount));
}

export function alpha(hex: string, a: number) {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Oscurece (modo claro) o aclara (modo oscuro) un color hasta alcanzar el contraste pedido sobre `bg`. */
function legible(color: string, bg: string, target: number, scheme: Scheme) {
  const towards = scheme === 'light' ? '#000000' : '#ffffff';
  let out = color;
  for (let step = 0; step <= 20 && contrast(out, bg) < target; step++) out = mix(color, towards, step * 0.05);
  return out;
}

function buildPalette(t: ThemeBase, scheme: Scheme): Palette {
  const n = neutrals[scheme];
  const soft = (c: string) => (scheme === 'light' ? mix(c, '#ffffff', 0.88) : mix(c, n.card, 0.78));
  const secondary = soft(t.primary);
  const successSoft = soft(t.success);
  const accentSoft = soft(t.accent);
  // El texto blanco sobre el botón primario debe leerse siempre.
  const primary = legible(t.primary, '#ffffff', 4.5, 'light');
  return {
    scheme,
    ...n,
    primary,
    // Se mide contra el fondo suave, que es la superficie menos contrastada donde aparece.
    primaryText: legible(t.primary, secondary, 4.5, scheme),
    primaryForeground: '#ffffff',
    secondary,
    destructive: scheme === 'light' ? '#c53030' : '#f87171',
    success: legible(t.success, successSoft, 4.5, scheme),
    successSoft,
    accent: legible(t.accent, accentSoft, 4.5, scheme),
    accentSoft,
    heroTint: scheme === 'light' ? mix(t.primary, '#ffffff', 0.86) : mix(t.primary, n.background, 0.8),
    overlay: scheme === 'light' ? 'rgba(16, 23, 31, 0.4)' : 'rgba(0, 0, 0, 0.6)',
    shadow: scheme === 'light' ? { boxShadow: '0 4px 20px rgba(33, 41, 54, 0.04)' } : {},
  };
}

export const palettes = Object.fromEntries(
  themes.map((t) => [t.id, { light: buildPalette(t, 'light'), dark: buildPalette(t, 'dark') }]),
) as Record<ThemeId, Record<Scheme, Palette>>;

export function toneColors(c: Palette, tone: Tone) {
  if (tone === 'success') return { color: c.success, background: c.successSoft };
  if (tone === 'accent') return { color: c.accent, background: c.accentSoft };
  return { color: c.primaryText, background: c.secondary };
}

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fonts;

export const radius = { sm: 4, md: 6, lg: 8 } as const;

// Mismos puntos de quiebre que la versión web: < 800 móvil, < 1100 escritorio compacto.
export const breakpoints = { desktop: 800, wide: 1100 } as const;
