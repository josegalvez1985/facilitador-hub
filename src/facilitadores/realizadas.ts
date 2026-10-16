// "Intervenciones realizadas" = páginas 4 "Intervenciones", 5 "Días" y 6 "Manuales" de
// APEX 193573. GET intervenciones-realizadas/* (sql/intervenciones_realizadas_app_ethos.sql
// → PKG_REALIZADAS_APP_ETHOS), con el ID_FACILITADOR sacado del token en el servidor.

import { authFetch, filasDe } from './auth/api';

export type InstitucionRealizada = { id: number; nombre: string; marcaciones: number; desarrolladas: number };

export const DIAS_HABILES = [
  { clave: 'lunes', corto: 'L', largo: 'Lunes' },
  { clave: 'martes', corto: 'M', largo: 'Martes' },
  { clave: 'miercoles', corto: 'X', largo: 'Miércoles' },
  { clave: 'jueves', corto: 'J', largo: 'Jueves' },
  { clave: 'viernes', corto: 'V', largo: 'Viernes' },
] as const;
export type DiaHabil = (typeof DIAS_HABILES)[number]['clave'];

/** Una clase de la página 5: las filas con el mismo turno, grado y sección (la clave de la página 6). */
export type ClaseRealizada = {
  clave: string;
  turno: number;
  turnoDescripcion: string;
  grado: string;
  /** Tal como vino (puede ser null): se manda así a la página 6, que compara con NVL(…,'A'). */
  seccion: string | null;
  enfasis: string[];
  dias: DiaHabil[];
  marcaciones: number;
  desarrolladas: number;
};

export type IntervencionRealizada = {
  id: number;
  fecha: Date | null;
  manual: string | null;
  indice: string | null;
  observacion: string | null;
  desarrollada: boolean;
};

const txt = (v: unknown) => {
  const t = v === null || v === undefined ? '' : String(v).trim();
  return t || null;
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function fecha(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** Misma clave que el filtro de la página 6: turno, grado y NVL(sección,'A'). */
const claveClase = (turno: unknown, grado: unknown, seccion: unknown) => `${num(turno)}|${txt(grado) ?? ''}|${txt(seccion) ?? 'A'}`;

const esFacilitador = (r: unknown) => (r as { es_facilitador?: unknown }).es_facilitador !== false;

/** Página 4: tus instituciones del año lectivo, con sus contadores. */
export async function cargarInstituciones(): Promise<{ esFacilitador: boolean; instituciones: InstitucionRealizada[] }> {
  const r = await authFetch('intervenciones-realizadas/instituciones');
  return {
    esFacilitador: esFacilitador(r),
    instituciones: filasDe(r).map((f) => ({
      id: num(f.id_institucion),
      nombre: txt(f.nombre_institucion) ?? '',
      marcaciones: num(f.marcaciones),
      desarrolladas: num(f.desarrolladas),
    })),
  };
}

/** Agrupa las filas de la página 5 (una por día marcado) en una tarjeta por clase. */
export function aClases(filas: Record<string, unknown>[], resumen: Record<string, unknown>[]): ClaseRealizada[] {
  const contadores = new Map(resumen.map((r) => [claveClase(r.turno, r.grado, r.seccion), { marcaciones: num(r.marcaciones), desarrolladas: num(r.desarrolladas) }]));
  const clases = new Map<string, ClaseRealizada>();
  for (const f of filas) {
    const clave = claveClase(f.turno, f.grado, f.seccion);
    let c = clases.get(clave);
    if (!c) {
      c = {
        clave,
        turno: num(f.turno),
        turnoDescripcion: txt(f.turno_descripcion) ?? '',
        grado: txt(f.grado) ?? '',
        seccion: txt(f.seccion),
        enfasis: [],
        dias: [],
        marcaciones: contadores.get(clave)?.marcaciones ?? 0,
        desarrolladas: contadores.get(clave)?.desarrolladas ?? 0,
      };
      clases.set(clave, c);
    }
    const enfasis = txt(f.enfasis);
    if (enfasis && !c.enfasis.includes(enfasis)) c.enfasis.push(enfasis);
    for (const d of DIAS_HABILES) if (txt(f[d.clave]) && !c.dias.includes(d.clave)) c.dias.push(d.clave);
  }
  // Orden pedido: turno, grado y sección (el servidor ya las manda así).
  return [...clases.values()];
}

/** Página 5: las clases que marcaste en una institución. */
export async function cargarClases(idInstitucion: number): Promise<ClaseRealizada[]> {
  const r = await authFetch(`intervenciones-realizadas/clases?id_institucion=${encodeURIComponent(idInstitucion)}`);
  const data = ((r as { data?: unknown }).data ?? {}) as { filas?: unknown; resumen?: unknown };
  return aClases(filasDe({ data: data.filas }), filasDe({ data: data.resumen }));
}

/** Página 6: historial de una clase, de la más nueva a la más vieja. */
export async function cargarHistorial(idInstitucion: number, clase: ClaseRealizada): Promise<IntervencionRealizada[]> {
  const q = new URLSearchParams({ id_institucion: String(idInstitucion), turno: String(clase.turno), grado: clase.grado });
  if (clase.seccion) q.set('seccion', clase.seccion);
  const r = await authFetch(`intervenciones-realizadas/historial?${q.toString()}`);
  return filasDe(r).map((f) => ({
    id: num(f.id_intervencion),
    fecha: fecha(f.fecha_hora),
    manual: txt(f.manual),
    indice: txt(f.indice),
    observacion: txt(f.observacion),
    desarrollada: txt(f.desarrollo) === 'Si',
  }));
}

/** "8º A" (como el texto de la página 5) */
export const nombreClase = (c: Pick<ClaseRealizada, 'grado' | 'seccion'>) => `${c.grado}${c.seccion ? ` ${c.seccion}` : ''}`;

/** Porcentaje entero de "Sí" (0 si no hay marcaciones). */
export const porcentaje = (desarrolladas: number, marcaciones: number) => (marcaciones ? Math.round((desarrolladas / marcaciones) * 100) : 0);
