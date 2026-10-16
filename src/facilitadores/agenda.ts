// "Mis horarios": equivalente a la página 3 ("Agenda") de la app APEX 193573.
//
// GET mi-agenda (sql/agenda_app_ethos.sql → PKG_AGENDA_APP_ETHOS.MI_AGENDA) corre el
// mismo SELECT de la página, con :APP_USER sacado del TOKEN:
//
//   select * from V_AGENDA A
//    WHERE A.USUARIO = :APP_USER AND NVL(A.ESTADO,'Activo') = 'Activo'
//      AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
//    order by turno, lunes, martes, miercoles, jueves, viernes, grado
//
// En V_AGENDA cada día viene como 'hh24:mi, hh24:mi', o ', ' cuando ese día no hay clase.

import { authFetch, filasDe } from './auth/api';

export const DIAS_AGENDA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;
export type DiaAgenda = (typeof DIAS_AGENDA)[number];

export type Horario = { desde: string; hasta: string };

export type ClaseAgenda = {
  idPostulacion: number;
  idInstitucion: number | null;
  institucion: string;
  turno: number | null;
  turnoDescripcion: string;
  grado: string;
  seccion: string | null;
  profesor: string | null;
  enfasis: string | null;
  manual: string | null;
  ciudad: string | null;
  departamento: string | null;
  dias: Partial<Record<DiaAgenda, Horario>>;
};

const TURNOS: Record<number, string> = { 1: 'Mañana', 2: 'Tarde', 3: 'Noche' };
const txt = (v: unknown) => {
  const t = v === null || v === undefined ? '' : String(v).trim();
  return t && t !== '-' ? t : null;
};

/** "08:20, 09:00" → { desde: "08:20", hasta: "09:00" }; ", " (sin clase) → null. */
export function leerHorario(v: unknown): Horario | null {
  const [desde, hasta] = String(v ?? '').split(',').map((p) => p.trim());
  return desde ? { desde, hasta: hasta ?? '' } : null;
}

export function aClases(filas: Record<string, unknown>[]): ClaseAgenda[] {
  return filas.map((f) => {
    const turno = f.turno === null || f.turno === undefined ? null : Number(f.turno);
    const dias: Partial<Record<DiaAgenda, Horario>> = {};
    for (const d of DIAS_AGENDA) {
      const h = leerHorario(f[d]);
      if (h) dias[d] = h;
    }
    return {
      idPostulacion: Number(f.id_postulacion),
      idInstitucion: f.id_institucion === null || f.id_institucion === undefined ? null : Number(f.id_institucion),
      institucion: txt(f.nombre_institucion) ?? '',
      turno,
      turnoDescripcion: txt(f.turno_descripcion) ?? (turno !== null ? (TURNOS[turno] ?? String(turno)) : ''),
      grado: txt(f.grado) ?? '',
      seccion: txt(f.seccion),
      profesor: txt(f.nombre_profesor),
      enfasis: txt(f.enfasis),
      manual: txt(f.manual),
      ciudad: txt(f.ciudad),
      departamento: txt(f.departamento),
      dias,
    };
  });
}

/** Día de la semana de JS (0 = domingo) → columna de V_AGENDA. Sábado y domingo no tienen columna. */
export function diaAgenda(fecha: Date): DiaAgenda | null {
  return DIAS_AGENDA[fecha.getDay() - 1] ?? null;
}

/** Clases de un día, en el orden de la página (turno, horario, grado). */
export function clasesDelDia(clases: ClaseAgenda[], dia: DiaAgenda | null): (ClaseAgenda & { horario: Horario })[] {
  if (!dia) return [];
  return clases
    .filter((c) => c.dias[dia])
    .map((c) => ({ ...c, horario: c.dias[dia] as Horario }))
    .sort((a, b) => (a.turno ?? 9) - (b.turno ?? 9) || a.horario.desde.localeCompare(b.horario.desde) || a.grado.localeCompare(b.grado));
}

export type Agenda = { esFacilitador: boolean; clases: ClaseAgenda[] };

/** Agenda del facilitador de la sesión (el servidor saca el usuario del token). */
export async function cargarAgenda(): Promise<Agenda> {
  const r = await authFetch('mi-agenda');
  return { esFacilitador: (r as { es_facilitador?: unknown }).es_facilitador !== false, clases: aClases(filasDe(r)) };
}
