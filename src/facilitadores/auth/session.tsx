import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useToast } from '../toast';
import { adoptarSesion, cerrarSesion, CLAVE_SESION_WEB, getSesion, login as apiLogin, logout as apiLogout, msHastaExpirar, sesionDeTexto, setOnUnauthorized, type Sesion } from './api';
import { idFacilitadorDeSesion, olvidarFacilitador } from './facilitador';

/** ID_FACILITADOR del usuario logueado (ver facilitador.ts). `id: null` = no es facilitador. */
export type FacilitadorSesion = { estado: 'cargando' } | { estado: 'listo'; id: number | null } | { estado: 'error'; mensaje: string };

type Ctx = {
  sesion: Sesion | null;
  /** false hasta que monta: el guardia no redirige antes. */
  ready: boolean;
  /** Valor global: toda consulta de datos del facilitador se filtra por este id. */
  facilitador: FacilitadorSesion;
  reintentarFacilitador: () => void;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

type ResultadoFacilitador = { token: string } & ({ estado: 'listo'; id: number | null } | { estado: 'error'; mensaje: string });

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [sesion, setSesion] = useState<Sesion | null>(() => getSesion());
  const [ready, setReady] = useState(false);

  // Marca de montaje a propósito: el guardia (hijo) corre sus efectos antes que este provider.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setReady(true), []);

  /** id fijo: si vencen varias llamadas en paralelo, sale UN aviso y no tres. */
  const caerSesion = useCallback(
    (motivo: string) => {
      cerrarSesion();
      olvidarFacilitador();
      setSesion(null);
      toast.error('Tu sesión se cerró', { id: 'sesion-caida', description: motivo });
    },
    [toast],
  );

  // Cualquier 401 tira la sesión. La redirección la hace el guardia al ver la sesión en null.
  useEffect(() => {
    setOnUnauthorized(() => caerSesion('Volvé a iniciar sesión para continuar.'));
    return () => setOnUnauthorized(() => {});
  }, [caerSesion]);

  // Vencimiento proactivo: el token dura 6 h y no se renueva.
  const token = sesion?.token;
  const expira = sesion?.expira;
  useEffect(() => {
    if (!token) return;
    const restante = msHastaExpirar(expira);
    if (restante === null) return; // queda el chequeo reactivo del 401
    // Piso 1 s; techo en el máximo de setTimeout (arriba de ~24,8 días desborda y se dispara al instante).
    const espera = Math.min(Math.max(restante, 1_000), 2_147_483_647);
    const id = setTimeout(() => caerSesion('El token venció. Volvé a iniciar sesión.'), espera);
    return () => clearTimeout(id);
  }, [token, expira, caerSesion]);

  // Los timers se frenan con la app en segundo plano (o la pestaña oculta en la PWA): al volver, revisar.
  // Se calcula en ese momento: en segundo plano no hay renders que lo mantengan al día.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      const actual = getSesion();
      if (estado !== 'active' || !actual) return;
      if ((msHastaExpirar(actual.expira) ?? 1) <= 0) caerSesion('El token venció. Volvé a iniciar sesión.');
    });
    return () => sub.remove();
  }, [caerSesion]);

  // Web: varias pestañas comparten la sesión (localStorage, ver api.ts). Si otra pestaña cierra
  // sesión, vence o entra con otro usuario, esta la sigue. "storage" solo llega a las OTRAS pestañas.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const alCambiar = (ev: StorageEvent) => {
      if (ev.key !== CLAVE_SESION_WEB && ev.key !== null) return;
      const nueva = sesionDeTexto(ev.newValue);
      const actual = getSesion();
      if (nueva?.token === actual?.token) return;
      adoptarSesion(nueva);
      olvidarFacilitador();
      setSesion(nueva);
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  // ID_FACILITADOR: se resuelve una vez por token, apenas hay sesión. El resultado queda
  // marcado con su token: si cambia la sesión, el de la anterior no se usa nunca.
  const [resultado, setResultado] = useState<ResultadoFacilitador | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!token) return;
    let vigente = true;
    idFacilitadorDeSesion()
      .then((id) => vigente && setResultado({ token, estado: 'listo', id }))
      .catch((e: unknown) => vigente && setResultado({ token, estado: 'error', mensaje: e instanceof Error ? e.message : String(e) }));
    return () => {
      vigente = false;
    };
  }, [token, intento]);

  const facilitador = useMemo<FacilitadorSesion>(() => {
    if (!token || !resultado || resultado.token !== token) return { estado: 'cargando' };
    return resultado.estado === 'listo' ? { estado: 'listo', id: resultado.id } : { estado: 'error', mensaje: resultado.mensaje };
  }, [token, resultado]);

  const reintentarFacilitador = useCallback(() => {
    setResultado(null);
    setIntento((n) => n + 1);
  }, []);

  const login = useCallback(async (usuario: string, password: string) => {
    olvidarFacilitador();
    setSesion(await apiLogin(usuario, password));
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    olvidarFacilitador();
    // Lo recordado NO se toca acá: se apaga destildando el check en el login.
    setSesion(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ sesion, ready, facilitador, reintentarFacilitador, login, logout }),
    [sesion, ready, facilitador, reintentarFacilitador, login, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider');
  return ctx;
}
