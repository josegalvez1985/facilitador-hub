import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/* ---------------------------------------------------------------------------
 * "Recordar usuario y contraseña" (opt-in). Con lo recordado se rehace el login;
 * la sesión no se revive.
 * - APK / iOS nativo: almacenamiento cifrado del sistema (Keystore / Keychain).
 * - PWA (web): localStorage. AHÍ LA CONTRASEÑA QUEDA EN TEXTO PLANO.
 * ------------------------------------------------------------------------- */
const CLAVE_USUARIO = 'facilitadores-usuario';
const CLAVE_PASSWORD = 'facilitadores-password';

const nativo = Platform.OS !== 'web';

async function leer(clave: string): Promise<string> {
  try {
    return (nativo ? await SecureStore.getItemAsync(clave) : await AsyncStorage.getItem(clave)) ?? '';
  } catch {
    return ''; // sin almacenamiento disponible
  }
}

async function escribir(clave: string, valor: string) {
  try {
    if (nativo) {
      if (valor) await SecureStore.setItemAsync(clave, valor);
      else await SecureStore.deleteItemAsync(clave);
    } else if (valor) await AsyncStorage.setItem(clave, valor);
    else await AsyncStorage.removeItem(clave);
  } catch {
    /* sin almacenamiento se pierde la comodidad, no el login */
  }
}

export const getUsuarioRecordado = () => leer(CLAVE_USUARIO);
export const getPasswordRecordada = () => leer(CLAVE_PASSWORD);
export const setUsuarioRecordado = (u: string) => escribir(CLAVE_USUARIO, u.trim());
export const setPasswordRecordada = (p: string) => escribir(CLAVE_PASSWORD, p);
