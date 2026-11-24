import { Linking, Platform } from 'react-native';

/**
 * URL fija del último APK: la publica .github/workflows/apk.yml en el release `apk-latest`
 * en cada push (el repo es público, así que se descarga sin cuenta de GitHub).
 */
export const URL_APK = 'https://github.com/josegalvez1985/facilitador-hub/releases/download/apk-latest/facilitadores.apk';

/**
 * Si el login ofrece bajar el APK: solo en la web (dentro de la app instalada no tiene sentido)
 * y no en iPhone/iPad, donde un APK no se instala (el iPad con iPadOS se presenta como Mac).
 */
export function ofrecerApk(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return !ios;
}

/**
 * Abre la descarga. El parámetro cambia en cada toque: GitHub deja en caché un 404 de la URL
 * fija si alguien la pidió mientras el workflow reemplazaba el archivo, y con el parámetro
 * esa respuesta vieja no se usa.
 */
export function descargarApk() {
  void Linking.openURL(`${URL_APK}?v=${Date.now()}`);
}
