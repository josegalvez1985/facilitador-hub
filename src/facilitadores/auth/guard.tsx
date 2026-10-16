import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';
import { useSession } from './session';

export function RequiereSesion({ children }: { children: ReactNode }) {
  const { sesion, ready } = useSession();
  const router = useRouter();
  const { colors } = useTheme();

  // `ready`: no redirigir antes de que el provider monte. replace: que "atrás" no vuelva acá.
  useEffect(() => {
    if (ready && !sesion) router.replace('/login');
  }, [ready, sesion, router]);

  // Sin sesión NO se pinta el contenido (se puede llegar por URL, favorito o enlace profundo).
  if (!sesion) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primaryText} />
        <Text color={colors.mutedForeground}>Verificando la sesión…</Text>
      </View>
    );
  }
  return <>{children}</>;
}
