// "Historial de intervenciones" = páginas 7 "Historial de Intervenciones" y 8 "Observación"
// de APEX 193573. Endpoints historial-intervenciones* (sql/historial_app_ethos.sql →
// PKG_HISTORIAL_APP_ETHOS), con el ID_FACILITADOR sacado del token en el servidor.

import { authFetch, ErrorApi, filasDe } from './auth/api';
import { ErrorDeCampo } from './intervenciones';

export type IntervencionHistorial = {
  id: number;
  fecha: Date | null;
  hora: string;
  manual: string | null;
  indice: string | null;
  observacion: string | null;
  siNo: string | null;
  motivo: string | null;
  institucion: string;
  turno: string;
  /** Como en la página: GRADO||' '||SECCION */
  grado: string;
  enfasis: string | null;
};

/** Página 8 al abrir: el registro y las listas del formulario. */
export type FormIntervencion = {
  id: number;
  manual: string;
  idIndice: number | null;
  siNo: string | null;
  motivo: string | null;
  observacion: string;
  indices: { id: number; titulo: string }[];
  motivos: string[];
};

export type CambiosIntervencion = { id_indice: number | null; si_no: string | null; motivo_desarrollo: string | null; observacion: string };

const txt = (v: unknown) => {
  const t = v === null || v === undefined ? '' : String(v).trim();
  return t || null;
};

const numONull = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function fecha(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** Página 7: tus intervenciones del año lectivo, la más nueva primero. */
export async function cargarHistorialIntervenciones(): Promise<IntervencionHistorial[]> {
  const r = await authFetch('historial-intervenciones');
  return filasDe(r).map((f) => ({
    id: Number(f.id_intervencion),
    fecha: fecha(f.fecha_hora),
    hora: txt(f.hora) ?? '',
    manual: txt(f.manual),
    indice: txt(f.indice),
    observacion: txt(f.observacion),
    siNo: txt(f.si_no),
    motivo: txt(f.motivo_desarrollo),
    institucion: txt(f.nombre) ?? '',
    turno: txt(f.turno_descripcion) ?? '',
    grado: txt(f.grado) ?? '',
    enfasis: txt(f.descripcion),
  }));
}

/** Texto en el que busca el buscador de la página 7 (FECHA, MANUAL, OBSERVACION, SI_NO, NOMBRE, GRADO, SECCION, DESCRIPCION). */
export function textoBusqueda(i: IntervencionHistorial) {
  const f = i.fecha;
  const dmy = f ? `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}` : '';
  return [dmy, i.manual, i.observacion, i.siNo, i.institucion, i.grado, i.enfasis].filter(Boolean).join(' ').toLowerCase();
}

/** Página 8, "Inicializar pantalla": el registro, sus índices (por manual) y los motivos. */
export async function cargarFormIntervencion(id: number): Promise<FormIntervencion> {
  const r = await authFetch(`historial-intervenciones/${encodeURIComponent(id)}`);
  const d = ((r as { data?: unknown }).data ?? {}) as Record<string, unknown>;
  return {
    id: Number(d.id_intervencion ?? id),
    manual: txt(d.manual) ?? '',
    idIndice: numONull(d.id_indice),
    siNo: txt(d.si_no),
    motivo: txt(d.motivo_desarrollo),
    observacion: txt(d.observacion) ?? '',
    indices: filasDe({ data: d.indices }).map((i) => ({ id: Number(i.id_indice), titulo: String(i.titulo ?? '') })),
    motivos: Array.isArray(d.motivos) ? d.motivos.map(String) : [],
  };
}

/** Página 8, "Aplicar Cambios". Una validación del servidor llega como ErrorDeCampo. */
export async function guardarCambiosIntervencion(id: number, cambios: CambiosIntervencion): Promise<void> {
  try {
    await authFetch(`historial-intervenciones/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
  } catch (e) {
    if (e instanceof ErrorApi && typeof e.datos.campo === 'string') throw new ErrorDeCampo(e.message, e.datos.campo);
    throw e;
  }
}
