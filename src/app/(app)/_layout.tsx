import { useEffect } from 'react';
import { Slot } from 'expo-router';

import { RequiereSesion } from '@/facilitadores/auth/guard';
import { useSession } from '@/facilitadores/auth/session';
import { useApp } from '@/facilitadores/provider';
import { AppShell } from '@/facilitadores/shell';

// Todas las secciones comparten el mismo shell para que escritorio y móvil naveguen igual.
// El guardia va acá, una sola vez: ninguna pantalla con sesión se pinta sin ella.
export default function AppLayout() {
  return (
    <RequiereSesion>
      <NombreDeSesion />
      <AppShell>
        <Slot />
      </AppShell>
    </RequiereSesion>
  );
}

// El nombre que se muestra en la app es el del usuario autenticado.
function NombreDeSesion() {
  const { sesion } = useSession();
  const { setName } = useApp();
  const nombre = sesion?.nombre;
  useEffect(() => {
    if (nombre) setName(nombre);
  }, [nombre, setName]);
  return null;
}
