/* ---------------------------------------------------------------------------
 * ID_FACILITADOR del usuario autenticado: el valor global que separa los datos
 * de cada facilitador. Lo calcula el SERVIDOR a partir del token, igual que las
 * páginas APEX con :APP_USER:
 *
 *   GET mi-facilitador  (sql/facilitador_app_ethos.sql)
 *   → { success, data: { usuario, id_facilitador, es_facilitador } }
 *
 *   NO_DATA_FOUND → id_facilitador null (sin error)
 *   OTHERS        → 'Error FACILITADORES. ' || SQLERRM
 *
 * REGLAS (no "arreglar"):
 * - Va atado al TOKEN: otra sesión (otro usuario) lo vuelve a calcular. Nunca se
 *   reusa el id de un usuario anterior.
 * - Si es null o no se pudo resolver, las pantallas NO piden datos.
 * - Los endpoints del facilitador (mis-evaluaciones, …) también sacan el id del
 *   token en el servidor: el cliente nunca manda el id de nadie.
 * ------------------------------------------------------------------------- */
import { authFetch, getSesion } from './api';

let cache: { token: string; promesa: Promise<number | null> } | null = null;

async function pedirIdFacilitador(): Promise<number | null> {
  let respuesta: unknown;
  try {
    respuesta = await authFetch('mi-facilitador');
  } catch (e) {
    // "Sesión expirada" y "Sin conexión" se propagan tal cual.
    if (e instanceof Error && (e.name === 'SinConexion' || /sesi[oó]n expirada/i.test(e.message))) throw e;
    const mensaje = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(mensaje)) {
      throw new Error('Falta publicar en el backend el endpoint mi-facilitador (sql/facilitador_app_ethos.sql).');
    }
    throw new Error(/^Error FACILITADORES/.test(mensaje) ? mensaje : `Error FACILITADORES. ${mensaje}`);
  }
  const data = ((respuesta as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
  const crudo = data.id_facilitador ?? data.ID_FACILITADOR;
  const id = crudo === null || crudo === undefined || crudo === '' ? NaN : Number(crudo);
  return Number.isFinite(id) ? id : null; // NO_DATA_FOUND → null
}

/** ID_FACILITADOR de la sesión actual (null si el usuario no es facilitador). Se calcula una vez por token. */
export function idFacilitadorDeSesion(): Promise<number | null> {
  const s = getSesion();
  if (!s) return Promise.reject(new Error('No hay sesión activa'));
  if (!cache || cache.token !== s.token) {
    const promesa = pedirIdFacilitador();
    cache = { token: s.token, promesa };
    // Un error (p. ej. sin red) no queda guardado: el próximo pedido reintenta.
    promesa.catch(() => {
      if (cache?.promesa === promesa) cache = null;
    });
  }
  return cache.promesa;
}

/** Se llama al cerrar o perder la sesión. */
export function olvidarFacilitador() {
  cache = null;
}

/** Descarta las filas de otro facilitador cuando la fila trae su id (defensa en profundidad). */
export function soloDelFacilitador<T extends Record<string, unknown>>(filas: T[], idFacilitador: number): T[] {
  return filas.filter((f) => f.id_facilitador === undefined || f.id_facilitador === null || Number(f.id_facilitador) === idFacilitador);
}
