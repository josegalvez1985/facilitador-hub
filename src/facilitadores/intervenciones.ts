// "Marcar": equivalente a la página 2 ("Intervención") de la app APEX 193573.
//
// Endpoints exclusivos (sql/intervenciones_app_ethos.sql → PKG_INTERVENCIONES_APP_ETHOS),
// todos con el ID_FACILITADOR y el usuario sacados del TOKEN en el servidor:
//
//   GET  mis-intervenciones/inicio    LOV + default de P2_ID_INSTITUCION, DESARROLLO_MOTIVOS, ubicación
//   GET  mis-intervenciones/horarios  LOV de P2_ID_POSTULACION
//   GET  mis-intervenciones/clase     LOVs de P2_GRADO, P2_SECCION, P2_TURNO, P2_ID_ENFASIS, P2_MANUAL
//   GET  mis-intervenciones/indices   LOV + default de P2_ID_INDICE
//   POST mis-intervenciones           validaciones de la página + INSERT en INTERVENCIONES

import { authFetch, ErrorApi } from './auth/api';

export type Opcion<T extends string | number | null = string | number | null> = { valor: T; etiqueta: string };

export type Inicio = {
  esFacilitador: boolean;
  instituciones: Opcion<number>[];
  institucionPorDefecto: number | null;
  motivos: string[];
  requiereUbicacion: boolean;
};

export type Clase = {
  grados: Opcion<string>[];
  secciones: Opcion<string | null>[];
  turnos: Opcion<number>[];
  enfasis: Opcion<number | null>[];
  manuales: Opcion<string>[];
};

export type Indices = { indices: Opcion<number>[]; indicePorDefecto: number | null };

export type NuevaIntervencion = {
  id_institucion: number;
  id_postulacion: number;
  grado: string;
  seccion: string | null;
  turno: number;
  id_enfasis: number | null;
  manual: string;
  id_indice: number;
  si_no: 'Si' | 'No';
  motivo_desarrollo: string | null;
  observacion: string | null;
  latitud: string | null;
  longitud: string | null;
};

/** Error de validación del servidor: `campo` indica qué control marcar. */
export class ErrorDeCampo extends Error {
  constructor(
    message: string,
    public campo: string | null,
  ) {
    super(message);
    this.name = 'ErrorDeCampo';
  }
}

type Json = Record<string, unknown>;
const data = (r: unknown) => ((r as { data?: unknown })?.data ?? {}) as Json;
const lista = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const txt = (v: unknown) => (v === null || v === undefined ? null : String(v));

/** Quita repetidos (los LOVs de V_INSTITUCIONES pueden traer la misma fila dos veces). */
function unicos<T extends string | number | null>(ops: Opcion<T>[]): Opcion<T>[] {
  const vistos = new Set<string>();
  return ops.filter((o) => {
    const k = String(o.valor);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

const q = (params: Record<string, string | number | null>) =>
  Object.entries(params)
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

export async function cargarInicio(): Promise<Inicio> {
  const d = data(await authFetch('mis-intervenciones/inicio'));
  return {
    esFacilitador: d.es_facilitador !== false,
    instituciones: unicos(lista(d.instituciones).map((i) => ({ valor: Number((i as Json).id), etiqueta: String((i as Json).nombre ?? '') }))),
    institucionPorDefecto: num(d.institucion_por_defecto),
    motivos: lista(d.motivos).map(String),
    requiereUbicacion: d.requiere_ubicacion !== false,
  };
}

export async function cargarHorarios(idInstitucion: number): Promise<Opcion<number>[]> {
  const r = await authFetch(`mis-intervenciones/horarios?${q({ id_institucion: idInstitucion })}`);
  return unicos(lista((r as { data?: unknown }).data).map((h) => ({ valor: Number((h as Json).id_postulacion), etiqueta: String((h as Json).horario ?? '') })));
}

const TURNOS: Record<number, string> = { 1: 'Mañana', 2: 'Tarde', 3: 'Noche' };

export async function cargarClase(idInstitucion: number, idPostulacion: number): Promise<Clase> {
  const d = data(await authFetch(`mis-intervenciones/clase?${q({ id_institucion: idInstitucion, id_postulacion: idPostulacion })}`));
  return {
    grados: unicos(lista(d.grados).filter((g) => g !== null).map((g) => ({ valor: String(g), etiqueta: String(g) }))),
    secciones: unicos(lista(d.secciones).map((s) => ({ valor: txt(s), etiqueta: txt(s) ?? 'Sin sección' }))),
    turnos: unicos(lista(d.turnos).map((t) => ({ valor: Number((t as Json).turno), etiqueta: txt((t as Json).descripcion) ?? TURNOS[Number((t as Json).turno)] ?? String((t as Json).turno) }))),
    enfasis: unicos(lista(d.enfasis).map((e) => ({ valor: num((e as Json).id_enfasis), etiqueta: txt((e as Json).descripcion) ?? 'Sin énfasis' }))),
    manuales: unicos(lista(d.manuales).filter((m) => m !== null).map((m) => ({ valor: String(m), etiqueta: String(m) }))),
  };
}

export async function cargarIndices(p: { idPostulacion: number; manual: string; grado: string; turno: number }): Promise<Indices> {
  const d = data(await authFetch(`mis-intervenciones/indices?${q({ id_postulacion: p.idPostulacion, manual: p.manual, grado: p.grado, turno: p.turno })}`));
  return {
    indices: unicos(lista(d.indices).map((i) => ({ valor: Number((i as Json).id_indice), etiqueta: String((i as Json).titulo ?? '') }))),
    indicePorDefecto: num(d.indice_por_defecto),
  };
}

export type Resumen = {
  esFacilitador: boolean;
  /** Marcaciones del mes actual y cuántas fueron "Si". */
  delMes: number;
  desarrolladasDelMes: number;
  /** Instituciones distintas en sus postulaciones del año lectivo actual. */
  instituciones: number;
  /** Índices desarrollados hasta la fecha y manuales completos (postulaciones 'Finalizado'). */
  indicesDesarrollados: number;
  manualesDesarrollados: number;
};

/** KPIs de Inicio del facilitador del token (GET mis-intervenciones/resumen). */
export async function cargarResumen(): Promise<Resumen> {
  const d = data(await authFetch('mis-intervenciones/resumen'));
  const n = (v: unknown) => Number(v) || 0;
  return {
    esFacilitador: d.es_facilitador !== false,
    delMes: n(d.del_mes),
    desarrolladasDelMes: n(d.desarrolladas_del_mes),
    instituciones: n(d.instituciones),
    indicesDesarrollados: n(d.indices_desarrollados),
    manualesDesarrollados: n(d.manuales_desarrollados),
  };
}

export type IntervencionReciente = {
  id: number;
  fecha: Date | null;
  siNo: string | null;
  motivo: string | null;
  manual: string | null;
  indice: string | null;
  institucion: string | null;
  grado: string | null;
  seccion: string | null;
};

/** "2026-10-16T08:30:00" (hora de Paraguay, como la guarda el trigger) → Date local. */
function leerFechaHora(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** "Actividad reciente": últimas intervenciones del facilitador del token. */
export async function cargarRecientes(limite = 5): Promise<IntervencionReciente[]> {
  const r = await authFetch(`mis-intervenciones/recientes?limite=${limite}`);
  return lista((r as { data?: unknown }).data).map((x) => {
    const f = x as Json;
    return {
      id: Number(f.id_intervencion),
      fecha: leerFechaHora(f.fecha_hora),
      siNo: txt(f.si_no),
      motivo: txt(f.motivo_desarrollo),
      manual: txt(f.manual),
      indice: txt(f.indice),
      institucion: txt(f.institucion),
      grado: txt(f.grado),
      seccion: txt(f.seccion),
    };
  });
}

export async function guardarIntervencion(datos: NuevaIntervencion): Promise<number | null> {
  try {
    const r = await authFetch('mis-intervenciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    return num(data(r).id_intervencion);
  } catch (e) {
    // Validación del servidor: se muestra junto al control que corresponde.
    if (e instanceof ErrorApi && typeof e.datos.campo === 'string') throw new ErrorDeCampo(e.message, e.datos.campo);
    throw e;
  }
}

/* ------------------------------ Validaciones ------------------------------ */
// Las mismas que la página 2 (requeridos, "OBS") y los triggers de INTERVENCIONES
// (TRG_INTERV_SINO_MOTIVO). El servidor las vuelve a aplicar al guardar.

export type Formulario = {
  id_institucion: number | null;
  id_postulacion: number | null;
  grado: string | null;
  seccion: string | null;
  turno: number | null;
  id_enfasis: number | null;
  manual: string | null;
  id_indice: number | null;
  si_no: 'Si' | 'No' | null;
  motivo_desarrollo: string | null;
  observacion: string;
};

export function validar(f: Formulario, ubicacion: { requerida: boolean; lista: boolean }): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.id_institucion === null) e.id_institucion = 'Elegí la institución.';
  if (f.id_postulacion === null) e.id_postulacion = 'Elegí el horario.';
  if (!f.grado) e.grado = 'Elegí el grado.';
  if (f.turno === null) e.turno = 'Elegí el turno.';
  if (!f.manual) e.manual = 'Elegí el manual.';
  if (f.id_indice === null) e.id_indice = 'Elegí el índice del manual.';
  if (!f.si_no) e.si_no = 'Indicá si desarrollaste la clase.';
  // TRG_INTERV_SINO_MOTIVO
  if (f.si_no === 'No' && !f.motivo_desarrollo) e.motivo_desarrollo = 'Debe ingresar motivo de desarrollo cuando la respuesta es NO';
  // Validación "OBS" de la página
  if ((f.si_no ?? 'No') === 'No' && f.motivo_desarrollo === 'Otros' && !f.observacion.trim()) e.observacion = 'Debe cargar una observación para guardar';
  if (ubicacion.requerida && !ubicacion.lista) e.ubicacion = 'Necesitamos tu ubicación para registrar la intervención.';
  return e;
}

/**
 * Colores de los manuales del sistema APEX (tabla de colores de los manuales, acciones
 * dinámicas "Nuevo" / "Nuevo_1" de la página 2). Única fuente de verdad: todas las
 * pantallas (Marcar, Mi agenda, línea de tiempo, Mis materiales) usan esta constante.
 */
export const COLOR_MANUAL: Record<string, string> = {
  SER: '#e74c3c', // rojo
  HACER: '#27ae60', // verde
  TENER: '#c39bd3', // lila
  CARACTER: '#a6a6a6', // gris
  VISION: '#f9e54e', // amarillo
  CORAJE: '#3498db', // celeste
  LIDERAZGO: '#e74c3c', // rojo
};
