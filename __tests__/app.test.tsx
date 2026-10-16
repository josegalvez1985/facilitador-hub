/// <reference types="jest" />
/// <reference path="../node_modules/expo-router/build/ts-declarations/expect.d.ts" />
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AppLayout from '@/app/(app)/_layout';
import { FacilitadoresProvider } from '@/facilitadores/provider';
import { HomeScreen } from '@/facilitadores/screens/home';
import { LoginScreen } from '@/facilitadores/screens/login';
import { MaterialsScreen } from '@/facilitadores/screens/materials';
import { ProfileScreen } from '@/facilitadores/screens/profile';
import { ScheduleScreen } from '@/facilitadores/screens/schedule';

// El layout raíz real espera a que carguen las fuentes; acá solo se necesita el provider.
function RootLayout() {
  return (
    <FacilitadoresProvider>
      <Slot />
    </FacilitadoresProvider>
  );
}

const routes = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/index': HomeScreen,
  '(app)/horarios': ScheduleScreen,
  '(app)/materiales': MaterialsScreen,
  '(app)/perfil': ProfileScreen,
  login: LoginScreen,
};

describe('Facilitadores', () => {
  it('muestra el inicio con el saludo de la demostración', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen).toHavePathname('/');
    expect(screen.getByText(/Buen día, María/)).toBeTruthy();
  });

  it('registra la entrada de demostración desde la clase próxima', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(screen.getByText('Marcar entrada'));
    await fireEvent.press(screen.getByText('Confirmar entrada'));
    expect(await screen.findByText('¡Entrada registrada!')).toBeTruthy();
    expect(screen.getAllByText('Entrada registrada').length).toBeGreaterThan(0);
  });

  it('navega a horarios desde la barra inferior', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(screen.getByText('Horarios'));
    expect(screen).toHavePathname('/horarios');
    expect(await screen.findByText('Tu semana, organizada para enseñar.')).toBeTruthy();
  });
});
