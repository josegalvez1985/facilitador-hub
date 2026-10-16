import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSession } from './auth/session';
import { demoUser } from './data';
import { guardarFoto, leerFoto } from './foto-perfil';

// Estado compartido de la demostración: vive solo en memoria mientras la app está abierta.
// Excepción: la foto de perfil, que queda guardada en este dispositivo (foto-perfil.ts).
type AppState = {
  marked: boolean;
  setMarked: (v: boolean) => void;
  markOpen: boolean;
  setMarkOpen: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
  /** Foto de perfil del usuario logueado (data URI), o null. */
  foto: string | null;
  setFoto: (uri: string | null) => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export function FacilitadoresProvider({ children }: { children: ReactNode }) {
  const [marked, setMarked] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [name, setName] = useState(demoUser.name);

  // La foto queda marcada con su usuario: al cambiar de sesión nunca se muestra la del anterior.
  const usuario = useSession().sesion?.usuario ?? null;
  const [fotoGuardada, setFotoGuardada] = useState<{ usuario: string; uri: string | null } | null>(null);
  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    leerFoto(usuario).then((uri) => vigente && setFotoGuardada({ usuario, uri }));
    return () => {
      vigente = false;
    };
  }, [usuario]);
  const foto = fotoGuardada && fotoGuardada.usuario === usuario ? fotoGuardada.uri : null;
  const setFoto = useCallback(
    async (uri: string | null) => {
      if (!usuario) return;
      await guardarFoto(usuario, uri);
      setFotoGuardada({ usuario, uri });
    },
    [usuario],
  );

  const value = useMemo(
    () => ({ marked, setMarked, markOpen, setMarkOpen, name, setName, foto, setFoto }),
    [marked, markOpen, name, foto, setFoto],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('FacilitadoresProvider missing');
  return c;
}
