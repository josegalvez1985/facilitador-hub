import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { demoUser } from './data';

// Estado compartido de la demostración: vive solo en memoria mientras la app está abierta.
type AppState = {
  marked: boolean;
  setMarked: (v: boolean) => void;
  markOpen: boolean;
  setMarkOpen: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function FacilitadoresProvider({ children }: { children: ReactNode }) {
  const [marked, setMarked] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [name, setName] = useState(demoUser.name);
  const value = useMemo(() => ({ marked, setMarked, markOpen, setMarkOpen, name, setName }), [marked, markOpen, name]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('FacilitadoresProvider missing');
  return c;
}
