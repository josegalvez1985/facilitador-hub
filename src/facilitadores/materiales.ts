// "Mis materiales": manuales e índices del facilitador, desarrollados y pendientes.
// GET mis-materiales (sql/materiales_app_ethos.sql → PKG_MATERIALES_APP_ETHOS), con el
// usuario sacado del token.

import { authFetch, filasDe } from './auth/api';

export type IndiceMaterial = { id: number; nro: number; titulo: string; desarrollado: boolean; fecha: Date | null };

export type ManualFacilitador = {
  idPostulacion: number;
  institucion: string;
  grado: string;
  seccion: string | null;
  turno: string;
  manual: string;
  estado: string | null;
  indices: IndiceMaterial[];
  desarrollados: number;
  /** Siguiente al último desarrollado (mismo criterio que Mi agenda); null si está completo. */
  siguiente: IndiceMaterial | null;
  completo: boolean;
};

const txt = (v: unknown) => {
  const t = v === null || v === undefined ? '' : String(v).trim();
  return t && t !== '-' ? t : null;
};

function fecha(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

export function aManuales(filas: Record<string, unknown>[]): ManualFacilitador[] {
  return filas.map((f) => {
    const indices = (Array.isArray(f.indices) ? (f.indices as Record<string, unknown>[]) : [])
      .map((i) => ({
        id: Number(i.id_indice),
        nro: Number(i.nro_indice),
        titulo: String(i.titulo ?? ''),
        desarrollado: i.desarrollado === true || i.desarrollado === 'true',
        fecha: fecha(i.fecha_desarrollo),
      }))
      .sort((a, b) => a.nro - b.nro);
    const desarrollados = indices.filter((i) => i.desarrollado).length;
    const ultimo = Math.max(-Infinity, ...indices.filter((i) => i.desarrollado).map((i) => i.nro));
    const siguiente = indices.find((i) => i.nro > ultimo) ?? null;
    return {
      idPostulacion: Number(f.id_postulacion),
      institucion: txt(f.institucion) ?? '',
      grado: txt(f.grado) ?? '',
      seccion: txt(f.seccion),
      turno: txt(f.turno_descripcion) ?? '',
      manual: String(f.manual ?? ''),
      estado: txt(f.estado),
      indices,
      desarrollados,
      siguiente,
      completo: indices.length > 0 && !siguiente,
    };
  });
}

export async function cargarMateriales(): Promise<{ esFacilitador: boolean; manuales: ManualFacilitador[] }> {
  const r = await authFetch('mis-materiales');
  return { esFacilitador: (r as { es_facilitador?: unknown }).es_facilitador !== false, manuales: aManuales(filasDe(r)) };
}

/** Texto para exportar/compartir el índice de un manual con su estado. */
export function textoIndice(m: ManualFacilitador) {
  const lineas = m.indices.map((i) => `${i.desarrollado ? '[x]' : '[ ]'} ${i.titulo}`);
  return `${m.manual} · ${m.grado} grado${m.seccion ? ` ${m.seccion}` : ''}\n${m.institucion}\n\nÍndice (${m.desarrollados} de ${m.indices.length} desarrollados)\n${lineas.join('\n')}`;
}
