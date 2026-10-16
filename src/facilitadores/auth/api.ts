import { Platform } from 'react-native';

// Expo solo inyecta en el bundle las variables con prefijo EXPO_PUBLIC_, y las fija al
// arrancar el servidor. Si llega vacía o con un valor de ejemplo ("<esquema>"), se usa
// el módulo publicado: así un servidor viejo o un .env incompleto no rompen el login.
const API_POR_DEFECTO = 'https://oracleapex.com/ords/fundcarac/ethos/';
const API_ENV = process.env.EXPO_PUBLIC_API_URL ?? '';
const BASE = /^https?:\/\/[^\s<>]+$/.test(API_ENV) ? API_ENV : API_POR_DEFECTO;

function url(path: string) {
  return `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

// En web evita respuestas cacheadas. En nativo se omite: el polyfill de fetch de
// React Native agrega "?_=timestamp" a los GET cuando ve cache: 'no-store'.
const noCache: RequestInit = Platform.OS === 'web' ? { cache: 'no-store' } : {};

export type Sesion = {
  token: string;
  /** Siempre en MAYÚSCULAS. */
  usuario: string;
  /** Nombre para mostrar; cae al usuario si no viene. */
  nombre: string;
  email: string;
  /** ISO SIN zona, tal como lo emite el backend. */
  expira: string;
};

/* ---------------------------------------------------------------------------
 * La sesión vive SOLO en memoria. El token NUNCA se escribe en almacenamiento
 * persistente: cerrar la app (o recargar la PWA) vuelve al login, y es a propósito.
 * ------------------------------------------------------------------------- */
let sesionActual: Sesion | null = null;

export function getSesion(): Sesion | null {
  return sesionActual;
}

export function cerrarSesion() {
  sesionActual = null;
}

/* ---------------------------------------------------------------------------
 * Sin red NO es lo mismo que "el servidor dijo que no". Un 401 tira la sesión;
 * quedarse sin señal no dice nada del token.
 * ------------------------------------------------------------------------- */
export class SinConexion extends Error {
  constructor() {
    super('Sin conexión con el servidor. Revisá tu red.');
    this.name = 'SinConexion';
  }
}

export function esSinConexion(e: unknown): e is SinConexion {
  return e instanceof SinConexion;
}

/** fetch solo rechaza por red, CORS o abort: un 4xx/5xx llega como respuesta. */
async function pedir(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new SinConexion();
  }
}

/** Token muerto aunque el status no llegue como 401. */
function esTokenInvalido(res: Response, data: { success?: unknown; message?: unknown }) {
  return (
    res.status === 401 ||
    (data?.success === false && typeof data?.message === 'string' && /token\s+inv[aá]lido|token\s+expirado|expirad/i.test(data.message))
  );
}

/** Milisegundos que le quedan al token, o null si no se puede calcular. */
export function msHastaExpirar(expira: string | undefined): number | null {
  if (!expira) return null;
  const t = new Date(expira).getTime();
  return Number.isNaN(t) ? null : t - Date.now();
}

/** Lo registra SessionProvider: limpiar y volver al login. */
let onUnauthorized: () => void = () => {};

export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

function normalizar(data: Record<string, unknown>, usuarioTipeado: string): Sesion {
  const usuario = String(data.usuario ?? usuarioTipeado).toUpperCase();
  return {
    token: String(data.token ?? ''),
    usuario,
    nombre: String(data.nombre || '').trim() || usuario,
    email: String(data.email || '').trim(),
    expira: String(data.expira ?? ''),
  };
}

/* ------------------------------- Endpoints ------------------------------- */

export async function login(usuario: string, password: string): Promise<Sesion> {
  const res = await pedir(url('auth/login'), {
    ...noCache,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const data = (json?.data ?? json) as Record<string, unknown>;

  if (!res.ok || json?.success === false || !data?.token) {
    // El 401 y el 403 traen su mensaje: se muestra tal cual.
    throw new Error(String(json?.message ?? 'Usuario o contraseña incorrectos'));
  }

  sesionActual = normalizar(data, usuario);
  return sesionActual;
}

export async function logout(): Promise<void> {
  const s = getSesion();
  if (s) {
    // Best-effort: si el server no responde, igual se limpia lo local.
    await fetch(url('auth/logout'), {
      ...noCache,
      method: 'POST',
      headers: { Authorization: `Bearer ${s.token}` },
    }).catch(() => {});
  }
  cerrarSesion();
}

/** Extrae las filas de una respuesta, venga como {data:[…]}, {data:{items:[…]}}, {items:[…]} o un arreglo.
 * Las claves se pasan a minúsculas: Oracle puede devolverlas en MAYÚSCULAS. */
export function filasDe(respuesta: unknown): Record<string, unknown>[] {
  const r = respuesta as { data?: unknown; items?: unknown } | unknown[] | null;
  const data = Array.isArray(r) ? r : r?.data;
  const lista = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown })?.items) ? (data as { items: unknown[] }).items : !Array.isArray(r) && Array.isArray(r?.items) ? r.items : [];
  return lista
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k.toLowerCase(), v])));
}

/** USAR EN TODA LLAMADA PROTEGIDA. Nunca un fetch con Authorization suelto. */
export async function authFetch(path: string, init: RequestInit = {}) {
  const s = getSesion();
  if (!s) throw new Error('No hay sesión activa');

  // Sin red lanza SinConexion y NO toca la sesión.
  const res = await pedir(url(path), {
    ...init,
    ...noCache,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${s.token}` },
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  // ANTES de res.ok: si no, una sesión vencida sale como error genérico.
  if (esTokenInvalido(res, data)) {
    cerrarSesion();
    onUnauthorized();
    throw new Error('Sesión expirada');
  }
  if (!res.ok || data?.success === false) {
    throw new ErrorApi(String(data?.message ?? 'Operación fallida'), res.status, data);
  }
  return data;
}

/** Error que devolvió el backend: conserva el status y el cuerpo (p. ej. `campo` de una validación). */
export class ErrorApi extends Error {
  constructor(
    message: string,
    public status: number,
    public datos: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ErrorApi';
  }
}
