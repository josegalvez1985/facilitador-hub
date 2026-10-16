// Frase del día de Inicio: aleatoria, pero sin repetir hasta haber mostrado TODAS.
// Cada ciclo de N días (N = cantidad de frases) usa un orden mezclado distinto; dentro
// del ciclo cada día toma la siguiente de ese orden. Es determinístico: todos ven la
// misma frase el mismo día y no cambia al reabrir la app.

import { hoy, numeroDeDia } from './fechas';
import { FRASES } from './frases';

/** Generador pseudoaleatorio con semilla (mulberry32). */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orden mezclado (Fisher-Yates) de las frases para un ciclo. */
function ordenDelCiclo(ciclo: number, n: number) {
  const r = aleatorio(ciclo * 2654435761 + 97);
  const orden = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [orden[i], orden[j]] = [orden[j]!, orden[i]!];
  }
  return orden;
}

export function fraseDelDia(d: Date = hoy()): string {
  const n = FRASES.length;
  if (!n) return '';
  const dia = numeroDeDia(d);
  const orden = ordenDelCiclo(Math.floor(dia / n), n);
  return FRASES[orden[dia % n]!] ?? '';
}
