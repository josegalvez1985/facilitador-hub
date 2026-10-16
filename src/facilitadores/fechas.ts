// Fechas en español a partir de la fecha ACTUAL del dispositivo.
// No depende de Intl/toLocaleDateString: en Hermes (Android) el soporte de locales varía.

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const may = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const hoy = () => new Date();

/** "Jueves, 16 de octubre de 2026" */
export const fechaLarga = (d: Date = hoy()) => `${may(DIAS[d.getDay()] ?? '')}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

/** "16 de octubre, 2026" */
export const fechaCorta = (d: Date = hoy()) => `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;

/** "Jueves, 16 de octubre" */
export const diaYMes = (d: Date) => `${may(DIAS[d.getDay()] ?? '')}, ${d.getDate()} de ${MESES[d.getMonth()]}`;

/** "13 oct." */
export const diaMesAbreviado = (d: Date) => `${d.getDate()} ${(MESES[d.getMonth()] ?? '').slice(0, 3)}.`;

export const nombreMes = (mes: number) => may(MESES[mes] ?? '');

export const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export type DiaSemana = { fecha: Date; corto: string; largo: string; numero: number; clave: string; esHoy: boolean };

/** Semana actual de lunes a domingo (la que contiene a `d`). */
export function semanaDe(d: Date = hoy()): DiaSemana[] {
  const lunes = sumarDias(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(lunes, i);
    const largo = DIAS[f.getDay()] ?? '';
    return {
      fecha: f,
      corto: largo.slice(0, 3).toUpperCase(),
      largo: may(largo),
      numero: f.getDate(),
      clave: `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`,
      esHoy: mismoDia(f, d),
    };
  });
}

/** Número de día del calendario local (cambia a medianoche): sirve para rotar contenido diario. */
export const numeroDeDia = (d: Date = hoy()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

/** Lunes a viernes. */
export const esDiaHabil = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
