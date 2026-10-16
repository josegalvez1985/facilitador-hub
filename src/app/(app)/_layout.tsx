import { Slot } from 'expo-router';

import { AppShell } from '@/facilitadores/shell';

// Todas las secciones comparten el mismo shell para que escritorio y móvil naveguen igual.
export default function AppLayout() {
  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
