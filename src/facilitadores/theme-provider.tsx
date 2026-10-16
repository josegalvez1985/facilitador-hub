import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultThemeId, palettes, themes, type Palette, type Scheme, type ThemeId } from './theme';

export type AppearanceMode = 'system' | Scheme;

type ThemeState = {
  colors: Palette;
  scheme: Scheme;
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => void;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  ready: boolean;
};

const STORAGE_KEY = 'facilitadores.apariencia';
const ThemeContext = createContext<ThemeState | null>(null);

const isThemeId = (v: unknown): v is ThemeId => themes.some((t) => t.id === v);
const isMode = (v: unknown): v is AppearanceMode => v === 'system' || v === 'light' || v === 'dark';

// Preferencia visual del dispositivo (no son datos de la cuenta): se guarda localmente.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<AppearanceMode>('system');
  const [themeId, setThemeId] = useState<ThemeId>(defaultThemeId);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { mode?: unknown; themeId?: unknown };
        if (isMode(saved.mode)) setMode(saved.mode);
        if (isThemeId(saved.themeId)) setThemeId(saved.themeId);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, themeId })).catch(() => {});
  }, [ready, mode, themeId]);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(() => ({ colors: palettes[themeId][scheme], scheme, mode, setMode, themeId, setThemeId, ready }), [themeId, scheme, mode, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('ThemeProvider missing');
  return c;
}

/** Crea un hook de estilos que se recalcula solo cuando cambia la paleta. */
export function makeStyles<T>(factory: (c: Palette) => T) {
  const cache = new WeakMap<Palette, T>();
  return function useStyles() {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = factory(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}
