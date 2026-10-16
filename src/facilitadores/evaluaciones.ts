// Evaluaciones del facilitador: equivalente a la página 11 ("Evaluaciones") de la app APEX 193573.
//
// El servidor corre la misma consulta de la página (sql/facilitador_app_ethos.sql →
// PKG_FACILITADOR_APP_ETHOS.MIS_EVALUACIONES), con el ID_FACILITADOR sacado del token:
// solo evaluaciones cerradas, agrupadas por institución/fechas/evaluador, con la
// calificación e indicador de escalas_evaluaciones, ordenadas por fecha desc.

import { authFetch, filasDe } from './auth/api';

export const TOTAL_ITEMS = 33;

export type Evaluacion = {
  clave: string;
  fechaDesde: string;
  aspectosPositivos: string;
  aspectosMejorar: string;
  marcadas: number;
  calificacion: string | null;
  /** "12/33" */
  puntuacion: string;
  indicador: string | null;
};

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function aEvaluaciones(filas: Record<string, unknown>[]): Evaluacion[] {
  return filas.map((f, i) => {
    const marcadas = Number(f.marcadas) || 0;
    const puntuacion = texto(f.puntuacion);
    return {
      clave: `${texto(f.fecha_desde)}-${i}`,
      fechaDesde: texto(f.fecha_desde),
      aspectosPositivos: texto(f.aspectos_positivos),
      aspectosMejorar: texto(f.aspectos_mejorar),
      marcadas,
      calificacion: texto(f.calificacion) || null,
      // Sin fila en escalas_evaluaciones el SQL da "/33": se muestra lo marcado.
      puntuacion: /^\d/.test(puntuacion) ? puntuacion : `${marcadas}/${TOTAL_ITEMS}`,
      indicador: texto(f.indicador) || null,
    };
  });
}

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10-15T00:00:00" → "15 de octubre de 2026". Si no se reconoce, se muestra tal cual. */
export function formatearFecha(f: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(f);
  const [anio, mes, dia] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : [];
  if (!anio || !mes || !dia) return f;
  return `${Number(dia)} de ${meses[Number(mes) - 1] ?? mes} de ${anio}`;
}

/** Evaluaciones del facilitador de la sesión. El id lo resuelve el servidor desde el token. */
export async function listarEvaluaciones(): Promise<Evaluacion[]> {
  return aEvaluaciones(filasDe(await authFetch('mis-evaluaciones')));
}
