import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/* ---------------------------------------------------------------------------
 * Entrar con huella o rostro (solo APK / nativo; 24/11/2026).
 *
 * NO guarda la sesión: el token sigue viviendo solo en memoria y al reabrir la
 * app se vuelve al login. Lo que hace es un LOGIN NUEVO con el usuario y la
 * contraseña guardados en el almacenamiento cifrado del sistema (Keystore /
 * Keychain, expo-secure-store), y solo después de que el sistema confirme la
 * huella o el rostro (expo-local-authentication).
 *
 * - Opt-in: se activa desde el login con "Entrar con huella la próxima vez",
 *   y se guarda solo después de un login correcto y de confirmar la huella.
 * - Claves propias, separadas de "Recordar usuario y contraseña".
 * - Cerrar sesión no la borra (igual que lo recordado). Se borra al destildar
 *   la opción y entrar, o si el servidor rechaza la contraseña guardada
 *   (la contraseña cambió).
 * - En la web/PWA no existe: siempre "no disponible".
 * ------------------------------------------------------------------------- */
const CLAVE_USUARIO = 'facilitadores-bio-usuario';
const CLAVE_PASSWORD = 'facilitadores-bio-password';

const nativo = Platform.OS !== 'web';

export type TipoBiometria = 'huella' | 'rostro' | 'biometria';

export type Biometria = {
  /** El celular tiene huella o rostro configurado. */
  disponible: boolean;
  tipo: TipoBiometria;
  /** Usuario con el que está activada, o '' si no está activada. */
  usuario: string;
};

const NADA: Biometria = { disponible: false, tipo: 'biometria', usuario: '' };

/** Texto para los botones: "huella", "rostro" o "huella o rostro". */
export const nombreBiometria = (t: TipoBiometria) => (t === 'huella' ? 'huella' : t === 'rostro' ? 'rostro' : 'huella o rostro');

async function leer(clave: string): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(clave)) ?? '';
  } catch {
    return '';
  }
}

/** Si el celular puede usarla, de qué tipo, y si está activada (con qué usuario). */
export async function estadoBiometria(): Promise<Biometria> {
  if (!nativo) return NADA;
  try {
    const [hardware, enrolada, tipos] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hardware || !enrolada) return NADA;
    const huella = tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const rostro = tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const tipo: TipoBiometria = huella && !rostro ? 'huella' : rostro && !huella ? 'rostro' : 'biometria';
    const usuario = (await leer(CLAVE_PASSWORD)) ? await leer(CLAVE_USUARIO) : '';
    return { disponible: true, tipo, usuario };
  } catch {
    return NADA;
  }
}

/**
 * Pide la huella o el rostro. true si el sistema la confirmó; false si la persona canceló
 * o eligió usar la contraseña. Un error de verdad (bloqueada por intentos, etc.) sale con
 * un mensaje para mostrar.
 */
async function confirmar(mensaje: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: mensaje,
    cancelLabel: 'Usar contraseña',
    // Solo biometría: el PIN del celular no reemplaza la contraseña de la cuenta.
    disableDeviceFallback: true,
  });
  if (r.success) return true;
  if (r.error === 'user_cancel' || r.error === 'system_cancel' || r.error === 'app_cancel' || r.error === 'user_fallback') return false;
  if (r.error === 'lockout') throw new Error('Demasiados intentos. Esperá un momento o entrá con tu contraseña.');
  if (r.error === 'not_enrolled' || r.error === 'not_available' || r.error === 'passcode_not_set') {
    throw new Error('Tu celular ya no tiene una huella o un rostro configurado. Entrá con tu contraseña.');
  }
  throw new Error('No se pudo confirmar tu identidad. Probá de nuevo o entrá con tu contraseña.');
}

/**
 * Activa la entrada con huella para este usuario, después de un login correcto. La primera vez
 * pide confirmar con la huella (así queda claro que se activa en este celular); si ya estaba
 * activada para el mismo usuario (`pedirConfirmacion` false) solo actualiza la contraseña, que
 * puede haber cambiado. Devuelve false si se canceló.
 */
export async function activarBiometria(usuario: string, password: string, pedirConfirmacion = true): Promise<boolean> {
  if (!nativo) return false;
  if (pedirConfirmacion && !(await confirmar('Confirmá para entrar así la próxima vez'))) return false;
  await SecureStore.setItemAsync(CLAVE_USUARIO, usuario.trim());
  await SecureStore.setItemAsync(CLAVE_PASSWORD, password);
  return true;
}

/** Borra lo guardado para la huella (destildar la opción, o contraseña cambiada). */
export async function desactivarBiometria(): Promise<void> {
  if (!nativo) return;
  try {
    await SecureStore.deleteItemAsync(CLAVE_PASSWORD);
    await SecureStore.deleteItemAsync(CLAVE_USUARIO);
  } catch {
    /* sin almacenamiento no hay nada que borrar */
  }
}

/**
 * Pide la huella y devuelve el usuario y la contraseña guardados para hacer el login.
 * null si la persona canceló o no hay nada guardado.
 */
export async function credencialesConBiometria(): Promise<{ usuario: string; password: string } | null> {
  if (!nativo) return null;
  const usuario = await leer(CLAVE_USUARIO);
  const password = await leer(CLAVE_PASSWORD);
  if (!usuario || !password) return null;
  if (!(await confirmar(`Entrar como ${usuario}`))) return null;
  return { usuario, password };
}
