// Listas fijas de los formularios: grados, manuales y días, en el orden de las columnas de
// POSTULACIONES. Copiadas de editorial-ethos-app (src/lib/postulaciones.ts), salvo los colores
// de los manuales, que salen de COLOR_MANUAL como en el resto de la app.

import { COLOR_MANUAL } from '../intervenciones';

export const GRADOS = [
  { valor: '2', corto: '2°', clave: 'g2' },
  { valor: '3', corto: '3°', clave: 'g3' },
  { valor: '4', corto: '4°', clave: 'g4' },
  { valor: '5', corto: '5°', clave: 'g5' },
  { valor: '6', corto: '6°', clave: 'g6' },
  { valor: '7', corto: '7°', clave: 'g7' },
  { valor: '8', corto: '8°', clave: 'g8' },
  { valor: '9', corto: '9°', clave: 'g9' },
  { valor: '1M', corto: '1°M', clave: 'g1m' },
  { valor: '2M', corto: '2°M', clave: 'g2m' },
  { valor: '3M', corto: '3°M', clave: 'g3m' },
] as const;
export type ClaveGrado = (typeof GRADOS)[number]['clave'];

/** "#rrggbb" → si un texto oscuro se lee mejor encima que uno blanco (luminancia relativa). */
function esClaro(hex: string) {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5) > 0.32;
}

const manual = (valor: string, nombre: string, corto: string, clave: string) => {
  const color = COLOR_MANUAL[valor] ?? '#a6a6a6';
  // La letra va oscura sobre los claros (Tener, Carácter, Visión), como en el formulario impreso.
  return { valor, nombre, corto, clave, color, tinta: esClaro(color) ? '#1f1f1f' : '#ffffff' };
};

export const MANUALES = [
  manual('SER', 'Ser', 'SER', 'ser'),
  manual('HACER', 'Hacer', 'HAC', 'hacer'),
  manual('TENER', 'Tener', 'TEN', 'tener'),
  manual('CARACTER', 'Carácter', 'CAR', 'caracter'),
  manual('VISION', 'Visión', 'VIS', 'vision'),
  manual('CORAJE', 'Coraje', 'COR', 'coraje'),
  manual('LIDERAZGO', 'Liderazgo', 'LID', 'liderazgo'),
] as const;
export type ClaveManual = 'ser' | 'hacer' | 'tener' | 'caracter' | 'vision' | 'coraje' | 'liderazgo';

export const DIAS = [
  { valor: 'LUNES', nombre: 'Lunes', corto: 'Lun', impreso: 'LUNES', clave: 'lunes' },
  { valor: 'MARTES', nombre: 'Martes', corto: 'Mar', impreso: 'MARTES', clave: 'martes' },
  { valor: 'MIERCOLES', nombre: 'Miércoles', corto: 'Mié', impreso: 'MIÉRC.', clave: 'miercoles' },
  { valor: 'JUEVES', nombre: 'Jueves', corto: 'Jue', impreso: 'JUEVES', clave: 'jueves' },
  { valor: 'VIERNES', nombre: 'Viernes', corto: 'Vie', impreso: 'VIERNES', clave: 'viernes' },
] as const;
export type ClaveDia = (typeof DIAS)[number]['clave'];

/** LOV de turno de las páginas APEX: 1 Mañana, 2 Tarde, 3 Noche. */
export function nombreTurno(turno: number | null): string | null {
  if (turno == null) return null;
  return ({ 1: 'Mañana', 2: 'Tarde', 3: 'Noche' } as Record<number, string>)[turno] ?? `Turno ${turno}`;
}

/** 'HH:MM' → minutos, o null. */
export function minutos(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Saca los caracteres que Windows y Android no aceptan en un nombre de archivo. */
export const limpio = (s: string, largo = 60) =>
  s
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, largo);
