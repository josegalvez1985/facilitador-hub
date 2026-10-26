// Datos de los Form. 1, 2 y 3: GET mis-formularios/* (sql/formularios_app_ethos.sql →
// PKG_FORMULARIOS_APP_ETHOS). El servidor saca el ID_FACILITADOR del token: solo llegan las
// postulaciones, intervenciones y el bloqueo del facilitador logueado.

import { authFetch, filasDe } from '../auth/api';
import { DIAS, GRADOS, MANUALES, type ClaveDia, type ClaveGrado, type ClaveManual } from './listas';

export type Franja = { desde: string; hasta: string };

/** Una postulación (una clase) con sus alumnos por grado y manual y sus horarios. */
export type Detalle = {
  id: number;
  turno: number | null;
  seccion: string;
  grados: Record<ClaveGrado, number>;
  manuales: Record<ClaveManual, number>;
  dias: Record<ClaveDia, Franja>;
  enfasis: string;
};

/** Una postulación activa del facilitador, con su institución. */
export type Postulacion = Detalle & { idInstitucion: number; institucion: string };

export type Etapa = { inicio: string; fin: string };

export type MisPostulaciones = {
  esFacilitador: boolean;
  anio: string;
  anioActual: string;
  /** Los años con postulaciones del facilitador, del más nuevo al más viejo. */
  anios: string[];
  facilitador: { nombre: string; telefono: string };
  etapas: Etapa[];
  postulaciones: Postulacion[];
};

export type Autoridad = { cargo: string; nombre: string; ci: string; telefono: string };

/** La cabecera de una institución y las clases del facilitador en ella (el Form. 1). */
export type Formulario = {
  anio: string;
  nombre: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  barrio: string;
  autoridades: Autoridad[];
  detalle: (Detalle & { materia: string; docente: string; telefono: string; nroItem: number })[];
  horarios: { turno: number | null; inicio: string; fin: string; total: string; observacion: string }[];
};

export type IntervencionForm = {
  id: number;
  idPostulacion: number;
  /** `DD/MM/YYYY`. */
  fecha: string;
  nroIndice: number | null;
  siNo: string;
  motivo: string;
};

export type DiasBloqueo = Record<ClaveDia, string>;

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null || v === '' ? null : Number(v));
const num = (v: unknown) => Number(v ?? 0) || 0;

function aDetalle(x: Record<string, unknown>): Detalle {
  return {
    id: Number(x.id),
    turno: n(x.turno),
    seccion: s(x.seccion),
    grados: Object.fromEntries(GRADOS.map((g) => [g.clave, num(x[g.clave])])) as Record<ClaveGrado, number>,
    manuales: Object.fromEntries(MANUALES.map((m) => [m.clave, num(x[m.clave])])) as Record<ClaveManual, number>,
    dias: Object.fromEntries(DIAS.map((d) => [d.clave, { desde: s(x[`${d.clave}_desde`]), hasta: s(x[`${d.clave}_hasta`]) }])) as Record<ClaveDia, Franja>,
    enfasis: s(x.enfasis),
  };
}

/** Las postulaciones activas del facilitador en un año (vacío = el lectivo actual), sus años y las etapas. */
export async function cargarMisPostulaciones(anio?: string): Promise<MisPostulaciones> {
  const r = (await authFetch(`mis-formularios/postulaciones${anio ? `?anio=${encodeURIComponent(anio)}` : ''}`)) as Record<string, unknown>;
  const f = (r.facilitador ?? {}) as Record<string, unknown>;
  return {
    esFacilitador: r.es_facilitador !== false,
    anio: s(r.anio),
    anioActual: s(r.anio_actual),
    anios: ((r.anios as unknown[] | undefined) ?? []).map(String),
    facilitador: { nombre: s(f.nombre), telefono: s(f.telefono) },
    etapas: ((r.etapas as Record<string, unknown>[] | undefined) ?? []).map((e) => ({ inicio: s(e.fecha_inicio), fin: s(e.fecha_fin) })),
    postulaciones: filasDe(r).map((x) => ({ ...aDetalle(x), idInstitucion: Number(x.id_institucion), institucion: s(x.institucion) })),
  };
}

/** La cabecera de una institución (datos, autoridades, horario) y las clases del facilitador en ella. */
export async function cargarInstitucion(idInstitucion: number, anio: string): Promise<Formulario> {
  const r = (await authFetch(`mis-formularios/institucion?id_institucion=${idInstitucion}&anio=${encodeURIComponent(anio)}`)) as Record<string, unknown>;
  const lista = (k: string) => ((r[k] as Record<string, unknown>[] | undefined) ?? []);
  return {
    anio: s(r.anio),
    nombre: s(r.nombre),
    direccion: s(r.direccion),
    departamento: s(r.departamento),
    ciudad: s(r.ciudad),
    barrio: s(r.barrio),
    autoridades: lista('autoridades').map((a) => ({ cargo: s(a.cargo), nombre: s(a.nombre), ci: s(a.ci), telefono: s(a.telefono) })),
    detalle: lista('detalle').map((x) => ({ ...aDetalle(x), materia: s(x.materia), docente: s(x.docente), telefono: s(x.telefono), nroItem: num(x.nro_item) })),
    horarios: lista('horarios').map((h) => ({ turno: n(h.turno), inicio: s(h.hora_inicio), fin: s(h.hora_fin), total: s(h.total), observacion: s(h.observacion) })),
  };
}

/** Las intervenciones del facilitador en una institución entre dos fechas `YYYY-MM-DD` (inclusive). */
export async function cargarIntervenciones(idInstitucion: number, desde: string, hasta: string): Promise<IntervencionForm[]> {
  const r = await authFetch(`mis-formularios/intervenciones?id_institucion=${idInstitucion}&desde=${desde}&hasta=${hasta}`);
  return filasDe(r).map((x) => ({
    id: num(x.id_intervencion),
    idPostulacion: num(x.id_postulacion),
    fecha: s(x.fecha),
    nroIndice: n(x.nro_indice),
    siNo: s(x.si_no),
    motivo: s(x.motivo_desarrollo),
  }));
}

/** Los horarios bloqueados del facilitador en un año, o null si no tiene. */
export async function cargarBloqueo(anio: string): Promise<DiasBloqueo | null> {
  const r = (await authFetch(`mis-formularios/bloqueos?anio=${encodeURIComponent(anio)}`)) as { data?: Record<string, unknown> | null };
  if (!r.data) return null;
  const d = r.data;
  return Object.fromEntries(DIAS.map((x) => [x.clave, s(d[x.clave])])) as DiasBloqueo;
}

/** Un endpoint sin publicar (ORDS responde "Not Found"). */
export const faltaPublicar = (mensaje: string) => /not found/i.test(mensaje);
export const FALTA_PUBLICAR = 'Falta publicar en el backend los endpoints de mis-formularios (sql/formularios_app_ethos.sql).';
