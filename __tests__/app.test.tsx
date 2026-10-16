/// <reference types='jest' />
/// <reference path='../node_modules/expo-router/build/ts-declarations/expect.d.ts' />
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';

import AppLayout from '@/app/(app)/_layout';
import { authFetch, cerrarSesion, esSinConexion, getSesion } from '@/facilitadores/auth/api';
import { SessionProvider } from '@/facilitadores/auth/session';
import { FacilitadoresProvider } from '@/facilitadores/provider';
import { EvaluationsScreen } from '@/facilitadores/screens/evaluations';
import { HomeScreen } from '@/facilitadores/screens/home';
import { LoginScreen } from '@/facilitadores/screens/login';
import { MarkScreen } from '@/facilitadores/screens/mark';
import { MaterialsScreen } from '@/facilitadores/screens/materials';
import { ProfileScreen } from '@/facilitadores/screens/profile';
import { ScheduleScreen } from '@/facilitadores/screens/schedule';
import { contrast, palettes, themes } from '@/facilitadores/theme';
import { ThemeProvider } from '@/facilitadores/theme-provider';
import { ToastProvider } from '@/facilitadores/toast';

const secureStore = (jest.requireMock('expo-secure-store') as { __store: Map<string, string> }).__store;

// El layout raíz real espera a que carguen las fuentes; acá solo se necesitan los providers.
function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider>
          <FacilitadoresProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </FacilitadoresProvider>
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

const routes = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/index': HomeScreen,
  '(app)/horarios': ScheduleScreen,
  '(app)/materiales': MaterialsScreen,
  '(app)/perfil': ProfileScreen,
  '(app)/evaluaciones': EvaluationsScreen,
  '(app)/marcar': MarkScreen,
  login: LoginScreen,
};

/* ------------------------------ fetch simulado ----------------------------- */

type Respuesta = { status: number; body: unknown } | 'sin-red';
const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** mi-facilitador del backend simulado: MGONZALEZ es el facilitador 7. */
const miFacilitador = (id: number | null) => json(200, { success: true, data: { usuario: 'MGONZALEZ', id_facilitador: id, es_facilitador: id !== null } });

/** Última llamada a una URL que contiene `fragmento`. */
function llamadaA(fragmento: string) {
  return [...fetchMock.mock.calls].reverse().find(([u]) => String(u).includes(fragmento)) ?? [];
}

function responder(...respuestas: Respuesta[]) {
  for (const r of respuestas) {
    fetchMock.mockImplementationOnce(async () => {
      if (r === 'sin-red') throw new TypeError('Network request failed');
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    });
  }
}

/** ISO sin zona, como lo emite el backend. */
function isoLocal(msDesdeAhora: number) {
  const d = new Date(Date.now() + msDesdeAhora);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const loginOk = (expira = isoLocal(6 * 3600_000)) => ({
  status: 200,
  body: { success: true, data: { token: 'TOKEN-123', usuario: 'mgonzalez', nombre: 'María González', email: 'maria@escuela.py', expira } },
});

async function escribirCredenciales(usuario = 'mgonzalez', password = 'secreta') {
  await fireEvent.changeText(screen.getByPlaceholderText('Tu usuario'), usuario);
  await fireEvent.changeText(screen.getByPlaceholderText('Tu contraseña'), password);
}

async function entrar(opciones: { recordar?: boolean; expira?: string } = {}) {
  await renderRouter(routes, { initialUrl: '/login' });
  responder(loginOk(opciones.expira));
  await escribirCredenciales();
  if (opciones.recordar) await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByText('Ingresar'));
  await waitFor(() => expect(screen).toHavePathname('/'));
}

beforeEach(async () => {
  cerrarSesion();
  secureStore.clear();
  await AsyncStorage.clear();
  fetchMock.mockReset();
  // Por defecto: la búsqueda del ID_FACILITADOR que la sesión hace al entrar.
  fetchMock.mockImplementation(async (url) => (String(url).includes('mi-facilitador') ? miFacilitador(7) : json(404, { success: false, message: 'Not Found' })));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

/* ---------------------------------- Login --------------------------------- */

describe('Login', () => {
  it('con credenciales correctas entra al inicio y "atrás" no vuelve al login', async () => {
    await entrar();
    expect(await screen.findByText(/Buen día, María/)).toBeTruthy();
    expect(testRouter.canGoBack()).toBe(false);
    const [url, init] = llamadaA('auth/login');
    expect(url).toContain('auth/login');
    expect(JSON.parse(String(init?.body))).toEqual({ usuario: 'mgonzalez', password: 'secreta' });
    expect(getSesion()?.usuario).toBe('MGONZALEZ');
  });

  it('con contraseña mala muestra el mensaje del backend y libera el botón', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    responder({ status: 401, body: { success: false, message: 'Usuario o contraseña incorrectos' } });
    await escribirCredenciales('mgonzalez', 'mala');
    await fireEvent.press(screen.getByText('Ingresar'));
    expect(await screen.findByText('Usuario o contraseña incorrectos')).toBeTruthy();
    expect(screen.getByText('Ingresar')).toBeTruthy();
    expect(screen).toHavePathname('/login');
  });

  it('con usuario bloqueado muestra el mensaje del 403', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    responder({ status: 403, body: { success: false, message: 'Usuario bloqueado. Contactá al administrador.' } });
    await escribirCredenciales();
    await fireEvent.press(screen.getByText('Ingresar'));
    expect(await screen.findByText('Usuario bloqueado. Contactá al administrador.')).toBeTruthy();
  });

  it('pide usuario y contraseña antes de llamar al backend', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    await fireEvent.press(screen.getByText('Ingresar'));
    expect(await screen.findByText('Ingresa tu usuario y contraseña')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin red avisa "Sin conexión" en el login', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    responder('sin-red');
    await escribirCredenciales();
    await fireEvent.press(screen.getByText('Ingresar'));
    expect(await screen.findByText('Sin conexión con el servidor. Revisá tu red.')).toBeTruthy();
  });
});

describe('Guardia y sesión', () => {
  it('abrir el inicio sin sesión lleva al login sin mostrar el contenido', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByText(/Buen día/)).toBeNull();
  });

  it('con "recordar" guarda usuario y contraseña, y nunca el token', async () => {
    await entrar({ recordar: true });
    expect(secureStore.get('facilitadores-usuario')).toBe('mgonzalez');
    expect(secureStore.get('facilitadores-password')).toBe('secreta');
    const todo = [...secureStore.values(), ...(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())).map(([, v]) => v)];
    expect(todo.join(' ')).not.toContain('TOKEN-123');
  });

  it('al reabrir la app vuelve al login con los campos llenos si se recordó', async () => {
    // La sesión vivía solo en memoria (beforeEach la limpió); lo recordado sigue en el Keystore.
    secureStore.set('facilitadores-usuario', 'mgonzalez');
    secureStore.set('facilitadores-password', 'secreta');
    await renderRouter(routes, { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(screen.getByPlaceholderText('Tu usuario').props.value).toBe('mgonzalez'));
    expect(screen.getByPlaceholderText('Tu contraseña').props.value).toBe('secreta');
    expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('sin "recordar" no guarda nada y borra lo que hubiera', async () => {
    secureStore.set('facilitadores-usuario', 'viejo');
    secureStore.set('facilitadores-password', 'vieja');
    await renderRouter(routes, { initialUrl: '/login' });
    await waitFor(() => expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ checked: true }));
    await fireEvent.press(screen.getByRole('checkbox')); // destildar
    responder(loginOk());
    await escribirCredenciales();
    await fireEvent.press(screen.getByText('Ingresar'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(secureStore.size).toBe(0);
  });

  it('un token invalidado mientras se usa da UN solo aviso y vuelve al login', async () => {
    await entrar();
    responder({ status: 200, body: { success: false, message: 'Token invalido o expirado' } }, { status: 401, body: {} });
    await act(async () => {
      await Promise.allSettled([authFetch('clases'), authFetch('materiales')]);
    });
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.getAllByText('Tu sesión se cerró')).toHaveLength(1);
    expect(getSesion()).toBeNull();
  });

  it('sin red una llamada protegida falla con "Sin conexión" y NO cierra la sesión', async () => {
    await entrar();
    responder('sin-red');
    let error: unknown;
    await act(async () => {
      error = await authFetch('clases').catch((e: unknown) => e);
    });
    expect(esSinConexion(error)).toBe(true);
    expect(getSesion()?.token).toBe('TOKEN-123');
    expect(screen).toHavePathname('/');
  });

  it('authFetch manda el token como Bearer', async () => {
    await entrar();
    responder({ status: 200, body: { success: true, data: [] } });
    await act(async () => {
      await authFetch('clases');
    });
    const [url, init] = llamadaA('/clases');
    expect(url).toContain('/clases');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN-123');
  });

  it('cerrar sesión avisa al backend y vuelve al login', async () => {
    await entrar();
    await testRouter.navigate('/perfil');
    responder({ status: 200, body: { success: true, message: 'Sesión cerrada' } });
    await fireEvent.press(screen.getByText('Cerrar sesión'));
    await waitFor(() => expect(screen).toHavePathname('/login'));
    const [url, init] = llamadaA('auth/logout');
    expect(url).toContain('auth/logout');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN-123');
    expect(getSesion()).toBeNull();
  });

  it('cuando vence el token cierra la sesión sola', async () => {
    await entrar({ expira: isoLocal(-1000) }); // ya vencido: se dispara en el piso de 1 s
    await waitFor(() => expect(screen).toHavePathname('/login'), { timeout: 3000 });
    expect(screen.getByText('Tu sesión se cerró')).toBeTruthy();
  });
});

/* ------------------------------- Pantallas -------------------------------- */

describe('Facilitadores', () => {
  it('registra la entrada de demostración desde la clase próxima', async () => {
    await entrar();
    await fireEvent.press(screen.getByText('Marcar entrada'));
    await fireEvent.press(screen.getByText('Confirmar entrada'));
    expect(await screen.findByText('¡Entrada registrada!')).toBeTruthy();
    expect(screen.getAllByText('Entrada registrada').length).toBeGreaterThan(0);
  });

  it('navega a horarios desde el Menú de la barra inferior', async () => {
    await entrar();
    await fireEvent.press(screen.getByLabelText('Menú'));
    await fireEvent.press(await screen.findByText('Mis horarios'));
    expect(screen).toHavePathname('/horarios');
    expect(await screen.findByText('Tu semana, organizada para enseñar.')).toBeTruthy();
  });
});

describe('Barra inferior del celular', () => {
  it('tiene solo Inicio, Marcar, Menú, Perfil y Salir', async () => {
    await entrar();
    for (const b of ['Inicio', 'Marcar', 'Menú', 'Perfil', 'Salir']) expect(screen.getByLabelText(b)).toBeTruthy();
    expect(screen.queryByText('Mis horarios')).toBeNull(); // está en el Menú, no en la barra
  });

  it('el Menú tiene todas las secciones y el Centro de ayuda', async () => {
    await entrar();
    await fireEvent.press(screen.getByLabelText('Menú'));
    for (const t of ['Mis horarios', 'Mis materiales', 'Evaluaciones', 'Mi perfil', 'Centro de ayuda']) expect(await screen.findByText(t)).toBeTruthy();
    await fireEvent.press(screen.getByText('Centro de ayuda'));
    expect(await screen.findByText(/comunícate con tu coordinador educativo/)).toBeTruthy();
  });

  it('Salir pide confirmación y cierra la sesión', async () => {
    await entrar();
    await fireEvent.press(screen.getByLabelText('Salir'));
    expect(await screen.findByText('¿Cerrar sesión?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(getSesion()).not.toBeNull();

    responder({ status: 200, body: { success: true } });
    await fireEvent.press(screen.getByLabelText('Salir'));
    const botones = await screen.findAllByText('Salir');
    await fireEvent.press(botones[botones.length - 1]!); // el botón de la confirmación
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(llamadaA('auth/logout')).not.toEqual([]);
  });
});

describe('Apariencia', () => {
  it('cambia a modo oscuro y a otro tema desde el perfil, y lo guarda', async () => {
    await entrar();
    await testRouter.navigate('/perfil');
    await fireEvent.press(screen.getByLabelText('Modo oscuro'));
    await fireEvent.press(screen.getByLabelText('Tema Bosque'));
    expect(screen.getByLabelText('Modo oscuro').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByLabelText('Tema Bosque').props.accessibilityState).toMatchObject({ checked: true });
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('facilitadores.apariencia')) ?? '{}')).toEqual({ mode: 'dark', themeId: 'bosque' }));
  });

  it('ofrece 6 temas con contraste legible en modo claro y oscuro', () => {
    expect(themes).toHaveLength(6);
    for (const t of themes) {
      for (const p of [palettes[t.id].light, palettes[t.id].dark]) {
        expect(contrast(p.primaryForeground, p.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.primaryText, p.secondary)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.success, p.successSoft)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.accent, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.foreground, p.card)).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

/* ------------------------------ Evaluaciones ------------------------------ */

describe('Evaluaciones (página 11 de APEX)', () => {
  // Filas tal como las arma PKG_FACILITADOR_APP_ETHOS.MIS_EVALUACIONES (ya agrupadas por el SQL de la página).
  const ev = (o: Record<string, unknown>) => ({ fecha_desde: '2026-09-01T00:00:00', aspectos_positivos: null, aspectos_mejorar: null, marcadas: 21, calificacion: 'Muy bueno', puntuacion: '21/33', indicador: 'Logrado', ...o });

  it('se abre desde el menú y muestra lo que devuelve mis-evaluaciones', async () => {
    await entrar();
    responder({ status: 200, body: { success: true, es_facilitador: true, data: [ev({ aspectos_positivos: 'Excelente manejo del grupo' })] } });
    await fireEvent.press(screen.getByLabelText('Menú'));
    await fireEvent.press(await screen.findByText('Evaluaciones'));
    await waitFor(() => expect(screen).toHavePathname('/evaluaciones'));
    expect(await screen.findByText('1 de septiembre de 2026')).toBeTruthy();
    expect(screen.getByText('21/33')).toBeTruthy();
    expect(screen.getByText('Muy bueno')).toBeTruthy();
    expect(screen.getByText('Logrado')).toBeTruthy();
    expect(screen.getByText('Excelente manejo del grupo')).toBeTruthy();
    const [url, init] = llamadaA('mis-evaluaciones');
    expect(url).toContain('mis-evaluaciones');
    expect(String(url)).not.toContain('id_facilitador'); // el id lo pone el servidor, no el cliente
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN-123');
  });

  it('sin escala asociada muestra lo marcado sobre 33', async () => {
    await entrar();
    responder({ status: 200, body: { success: true, data: [ev({ marcadas: 9, puntuacion: '/33', calificacion: null, indicador: null })] } });
    await testRouter.navigate('/evaluaciones');
    expect(await screen.findByText('9/33')).toBeTruthy();
  });

  it('sin evaluaciones cerradas muestra el mensaje de APEX', async () => {
    await entrar();
    responder({ status: 200, body: { success: true, es_facilitador: true, data: [] } });
    await testRouter.navigate('/evaluaciones');
    expect(await screen.findByText('No se ha encontrado ningún dato.')).toBeTruthy();
  });

  it('muestra el error del backend y permite reintentar', async () => {
    await entrar();
    responder({ status: 500, body: { success: false, message: 'Error: ORA-00942' } }, { status: 200, body: { success: true, data: [ev({})] } });
    await testRouter.navigate('/evaluaciones');
    expect(await screen.findByText('Error: ORA-00942')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('21/33')).toBeTruthy();
  });
});

describe('ID_FACILITADOR de la sesión (mi-facilitador)', () => {
  it('se resuelve una vez al entrar y queda como valor global', async () => {
    await entrar();
    await waitFor(() => expect(llamadaA('mi-facilitador')).not.toEqual([]));
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('mi-facilitador'))).toHaveLength(1);
  });

  it('si el usuario no es facilitador no pide evaluaciones', async () => {
    fetchMock.mockImplementation(async (url) => (String(url).includes('mi-facilitador') ? miFacilitador(null) : json(404, {})));
    await entrar();
    await testRouter.navigate('/evaluaciones');
    expect(await screen.findByText(/no está registrado como facilitador/)).toBeTruthy();
    expect(llamadaA('mis-evaluaciones')).toEqual([]);
  });

  it('si el endpoint no está publicado lo dice y no pide datos', async () => {
    fetchMock.mockImplementation(async () => json(404, { code: 'NotFound', message: 'Not Found' }));
    await entrar();
    await testRouter.navigate('/evaluaciones');
    expect(await screen.findByText(/Falta publicar en el backend el endpoint mi-facilitador/)).toBeTruthy();
    expect(llamadaA('mis-evaluaciones')).toEqual([]);
  });

  it('otra sesión vuelve a calcular el id (no se reusa el del usuario anterior)', async () => {
    await entrar();
    await waitFor(() => expect(llamadaA('mi-facilitador')).not.toEqual([]));
    await testRouter.navigate('/perfil');
    responder({ status: 200, body: { success: true } });
    await fireEvent.press(screen.getByText('Cerrar sesión'));
    await waitFor(() => expect(screen).toHavePathname('/login'));
    responder(loginOk());
    await escribirCredenciales('otro', 'clave');
    await fireEvent.press(screen.getByText('Ingresar'));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('mi-facilitador'))).toHaveLength(2));
  });
});

/* ------------------------- Marcar (página 2 de APEX) ------------------------ */

describe('Marcar: registrar intervención (página 2 de APEX)', () => {
  const Location = jest.requireMock('expo-location') as { requestForegroundPermissionsAsync: jest.Mock };

  /** Backend simulado de mis-intervenciones; `sobre` reemplaza respuestas puntuales. */
  function backendMarcar(sobre: Record<string, unknown> = {}) {
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      const r = (k: string, def: unknown) => json(200, { success: true, data: k in sobre ? sobre[k] : def });
      if (u.includes('mi-facilitador')) return miFacilitador(7);
      if (u.includes('mis-intervenciones/inicio'))
        return r('inicio', {
          es_facilitador: true,
          instituciones: [
            { id: 5, nombre: 'Escuela Básica 124' },
            { id: 6, nombre: 'Colegio Nacional' },
          ],
          institucion_por_defecto: 5,
          motivos: ['Jornada SIND', 'Lluvia', 'Feriado', 'Asueto', 'Actividad IE', 'Personal', 'Huelga Docente', 'Otros'],
          requiere_ubicacion: true,
        });
      if (u.includes('mis-intervenciones/horarios'))
        return r('horarios', [
          { id_postulacion: 50, horario: '07:00-08:30' },
          { id_postulacion: 51, horario: '10:00-11:30' },
        ]);
      if (u.includes('mis-intervenciones/clase'))
        return r('clase', { grados: ['3'], secciones: ['A'], turnos: [{ turno: 1, descripcion: 'Mañana' }], enfasis: [{ id_enfasis: null, descripcion: null }], manuales: ['SER'] });
      if (u.includes('mis-intervenciones/indices'))
        return r('indices', {
          indices: [
            { id_indice: 10, titulo: '1. El respeto' },
            { id_indice: 11, titulo: '2. La honestidad' },
          ],
          indice_por_defecto: 11,
        });
      if (u.endsWith('mis-intervenciones') && init?.method === 'POST')
        return 'post' in sobre ? (sobre.post as ReturnType<typeof json>) : json(200, { success: true, data: { id_intervencion: 900 } });
      return json(404, { success: false, message: 'Not Found' });
    });
  }

  const posts = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('mis-intervenciones') && i?.method === 'POST');

  async function abrirMarcar() {
    await entrar();
    await fireEvent.press(screen.getByLabelText('Marcar'));
    await waitFor(() => expect(screen).toHavePathname('/marcar'));
    // Institución por defecto (5) → primer horario (50) → grado/sección/turno/manual → índice por defecto (11)
    await waitFor(() => expect(screen.getByLabelText('Índice del manual: 2. La honestidad')).toBeTruthy());
  }

  beforeEach(() => backendMarcar());

  it('Marcar de la barra abre la página y completa la cascada como APEX', async () => {
    await abrirMarcar();
    // La ubicación se obtiene en segundo plano: sin problemas, no se muestra ningún aviso.
    expect(screen.queryByText(/Ubicación obtenida/)).toBeNull();
    expect(screen.getByLabelText('Institución: Escuela Básica 124')).toBeTruthy();
    expect(screen.getByLabelText('07:00-08:30').props.accessibilityState).toMatchObject({ checked: true });
    expect(llamadaA('mis-intervenciones/clase')[0]).toContain('id_institucion=5&id_postulacion=50');
    expect(llamadaA('mis-intervenciones/indices')[0]).toContain('id_postulacion=50&manual=SER&grado=3&turno=1');
    // El cliente nunca manda el id del facilitador.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('id_facilitador'))).toBe(false);
  });

  it('cambiar el horario recarga las listas que dependen de él', async () => {
    await abrirMarcar();
    await fireEvent.press(screen.getByLabelText('10:00-11:30'));
    await waitFor(() => expect(llamadaA('mis-intervenciones/clase')[0]).toContain('id_postulacion=51'));
    await waitFor(() => expect(llamadaA('mis-intervenciones/indices')[0]).toContain('id_postulacion=51'));
  });

  it('respeta las validaciones: requeridos, motivo con "No" y observación con "Otros"', async () => {
    await abrirMarcar();
    await fireEvent.press(screen.getByText('Guardar intervención'));
    expect(await screen.findByText('Indicá si desarrollaste la clase.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('No desarrollé la clase'));
    expect(await screen.findByText('Huelga Docente')).toBeTruthy(); // Motivo aparece solo con "No"
    await fireEvent.press(screen.getByText('Guardar intervención'));
    expect(await screen.findByText('Debe ingresar motivo de desarrollo cuando la respuesta es NO')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Otros'));
    await fireEvent.press(screen.getByText('Guardar intervención'));
    expect(await screen.findByText('Debe cargar una observación para guardar')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sí, desarrollé la clase'));
    expect(screen.queryByText('Huelga Docente')).toBeNull(); // Motivo se oculta con "Sí"
    expect(posts()).toHaveLength(0);
  });

  it('confirma y guarda con la ubicación, y vuelve al inicio', async () => {
    await abrirMarcar();
    await fireEvent.press(screen.getByLabelText('No desarrollé la clase'));
    await fireEvent.press(await screen.findByLabelText('Lluvia'));
    await fireEvent.changeText(screen.getByLabelText('Observación'), '  Se suspendió por tormenta  ');
    await fireEvent.press(screen.getByText('Guardar intervención'));
    expect(await screen.findByText('¿Está seguro que desea guardar esta intervención?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(await screen.findByText('Intervención registrada')).toBeTruthy();
    expect(JSON.parse(String(posts()[0]?.[1]?.body))).toEqual({
      id_institucion: 5,
      id_postulacion: 50,
      grado: '3',
      seccion: 'A',
      turno: 1,
      id_enfasis: null,
      manual: 'SER',
      id_indice: 11,
      si_no: 'No',
      motivo_desarrollo: 'Lluvia',
      observacion: 'Se suspendió por tormenta',
      latitud: '-25.2637',
      longitud: '-57.5759',
    });
  });

  it('muestra junto al campo el error de validación del servidor', async () => {
    backendMarcar({ post: json(400, { success: false, message: 'El horario no es una opcion valida.', campo: 'id_postulacion' }) });
    await abrirMarcar();
    await fireEvent.press(screen.getByLabelText('Sí, desarrollé la clase'));
    await fireEvent.press(screen.getByText('Guardar intervención'));
    await fireEvent.press(await screen.findByText('Guardar'));
    expect(await screen.findByText('El horario no es una opcion valida.')).toBeTruthy();
    expect(screen).toHavePathname('/marcar');
  });

  it('sin permiso de ubicación (y siendo obligatoria) no deja guardar', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await abrirMarcar();
    expect(screen.getByText('Permití el acceso a la ubicación para marcar.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sí, desarrollé la clase'));
    await fireEvent.press(screen.getByText('Guardar intervención'));
    expect(await screen.findByText('Necesitamos tu ubicación para registrar la intervención.')).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it('si los endpoints no están publicados lo avisa', async () => {
    fetchMock.mockImplementation(async (url) => (String(url).includes('mi-facilitador') ? miFacilitador(7) : json(404, { code: 'NotFound', message: 'Not Found' })));
    await entrar();
    await fireEvent.press(screen.getByLabelText('Marcar'));
    expect(await screen.findByText(/Falta publicar en el backend los endpoints de mis-intervenciones/)).toBeTruthy();
  });

  it('aparece en el Menú como "Registrar intervención"', async () => {
    await entrar();
    await fireEvent.press(screen.getByLabelText('Menú'));
    await fireEvent.press(await screen.findByText('Registrar intervención'));
    await waitFor(() => expect(screen).toHavePathname('/marcar'));
  });
});

/* --------------------------- KPI Marcaciones del mes ------------------------- */

describe('Inicio: KPI "Marcaciones del mes"', () => {
  it('muestra las intervenciones del mes del facilitador logueado', async () => {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('mi-facilitador')) return miFacilitador(7);
      if (u.includes('mis-intervenciones/resumen')) return json(200, { success: true, data: { es_facilitador: true, del_mes: 18, desarrolladas_del_mes: 15, mes: '2026-10' } });
      return json(404, {});
    });
    await entrar();
    expect(await screen.findByText('18')).toBeTruthy();
    expect(screen.getByText('15 desarrolladas')).toBeTruthy();
    // El id del facilitador lo resuelve el servidor desde el token.
    expect(String(llamadaA('mis-intervenciones/resumen')[0])).not.toContain('id_facilitador');
  });

  it('si el usuario no es facilitador no pide el resumen', async () => {
    fetchMock.mockImplementation(async (url) => (String(url).includes('mi-facilitador') ? miFacilitador(null) : json(404, {})));
    await entrar();
    expect(await screen.findByText('Sin registro de facilitador')).toBeTruthy();
    expect(llamadaA('mis-intervenciones/resumen')).toEqual([]);
  });
});

/* ------------------------ Mis horarios (página 3 de APEX) ------------------------ */

describe('Mis horarios: agenda (página 3 de APEX)', () => {
  // Filas como las devuelve mi-agenda (V_AGENDA): los días sin clase vienen como ', '.
  const fila = (o: Record<string, unknown>) => ({
    id_institucion: 1236,
    nombre_institucion: 'Escuela Básica N° 6304 San Roque Gonzalez de Santacruz',
    turno: 1,
    turno_descripcion: 'Mañana',
    grado: '8º',
    lunes: ', ',
    martes: ', ',
    miercoles: ', ',
    jueves: ', ',
    viernes: '08:20, 09:00',
    seccion: null,
    nombre_profesor: 'Ramon Ortiz Riveros',
    id_enfasis: null,
    enfasis: null,
    id_materia: 123,
    manual: 'TENER',
    estado: 'Activo',
    id_postulacion: 18120,
    anio: '2026',
    departamento: 'CENTRAL 1',
    ciudad: 'YPANÉ',
    ...o,
  });

  function backendAgenda(filas: Record<string, unknown>[]) {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('mi-facilitador')) return miFacilitador(7);
      if (u.includes('mi-agenda')) return json(200, { success: true, es_facilitador: true, data: filas });
      return json(404, {});
    });
  }

  async function abrirHorarios() {
    await entrar();
    await fireEvent.press(screen.getByLabelText('Menú'));
    await fireEvent.press(await screen.findByText('Mis horarios'));
    await waitFor(() => expect(screen).toHavePathname('/horarios'));
  }

  it('lee los horarios de V_AGENDA ("08:20, 09:00" o ", " sin clase)', () => {
    const { leerHorario } = jest.requireActual('@/facilitadores/agenda') as typeof import('@/facilitadores/agenda');
    expect(leerHorario('08:20, 09:00')).toEqual({ desde: '08:20', hasta: '09:00' });
    expect(leerHorario(', ')).toBeNull();
    expect(leerHorario(null)).toBeNull();
  });

  it('por día: el viernes muestra sus clases ordenadas por turno y horario', async () => {
    backendAgenda([
      fila({ id_postulacion: 18122, turno: 2, turno_descripcion: 'Tarde', grado: '3º', viernes: '13:00, 13:40', manual: 'SER' }),
      fila({ id_postulacion: 18121, grado: '9º', viernes: '09:00, 09:40', nombre_profesor: 'Alba B. Centurion' }),
      fila({}),
    ]);
    await abrirHorarios();
    await fireEvent.press(await screen.findByLabelText(/^Viernes \d+/));
    expect(await screen.findByText('3 clases')).toBeTruthy();
    const horas = screen.getAllByText(/^\d{2}:\d{2} – \d{2}:\d{2}$/).map((t) => t.props.children.join(''));
    expect(horas).toEqual(['08:20 – 09:00', '09:00 – 09:40', '13:00 – 13:40']);
    expect(screen.getByText('Prof. Alba B. Centurion')).toBeTruthy();
    expect(screen.getAllByText('TENER').length).toBeGreaterThan(0);
  });

  it('por día: un día sin clases lo dice', async () => {
    backendAgenda([fila({})]);
    await abrirHorarios();
    await fireEvent.press(await screen.findByLabelText(/^Lunes \d+/));
    expect(await screen.findByText('No hay clases programadas para este día.')).toBeTruthy();
  });

  it('semana completa: todas las filas con sus días', async () => {
    backendAgenda([fila({}), fila({ id_postulacion: 18200, grado: '5º', lunes: '07:00, 07:40', viernes: ', ' })]);
    await abrirHorarios();
    await fireEvent.press(screen.getByText('Semana completa'));
    expect(await screen.findByText('2 clases')).toBeTruthy();
    expect(screen.getByText('VIE 08:20–09:00')).toBeTruthy();
    expect(screen.getByText('LUN 07:00–07:40')).toBeTruthy();
  });

  it('sin datos muestra el mensaje de APEX, y sin endpoint lo avisa', async () => {
    backendAgenda([]);
    await abrirHorarios();
    expect(await screen.findByText('No se ha encontrado ningún dato')).toBeTruthy();
  });

  it('si el endpoint no está publicado lo avisa', async () => {
    fetchMock.mockImplementation(async (url) => (String(url).includes('mi-facilitador') ? miFacilitador(7) : json(404, { code: 'NotFound', message: 'Not Found' })));
    await abrirHorarios();
    expect(await screen.findByText(/Falta publicar en el backend el endpoint mi-agenda/)).toBeTruthy();
  });
});
