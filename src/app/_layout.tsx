import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

import { SessionProvider } from '@/facilitadores/auth/session';
import { FacilitadoresProvider } from '@/facilitadores/provider';
import { ThemeProvider, useTheme } from '@/facilitadores/theme-provider';
import { ToastProvider } from '@/facilitadores/toast';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <SessionProvider>
            <FacilitadoresProvider>
              <ThemedApp />
            </FacilitadoresProvider>
          </SessionProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { colors, scheme, ready } = useTheme();
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const fontsDone = loaded || !!error;

  // La pantalla de carga se mantiene hasta tener fuentes y la preferencia de tema guardada.
  useEffect(() => {
    if (fontsDone && ready) SplashScreen.hideAsync();
  }, [fontsDone, ready]);

  if (!fontsDone || !ready) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="login" options={{ title: 'Ingresar · Facilitadores' }} />
      </Stack>
    </>
  );
}
