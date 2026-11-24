// Subida directa a Cloudinary, compartida por Mis facturas y Mi postulación.
// El backend firma (el secreto queda en Oracle, CLOUDINARY_CONFIG) y devuelve
// { upload_url, campos: { api_key, timestamp, upload_preset, asset_folder, signature } };
// la app manda el archivo con esos campos y se queda con el secure_url.

import { Platform } from 'react-native';

import { authFetch, ErrorApi, pedirExterno } from './auth/api';

/** Un archivo del dispositivo listo para subir. `file`: el File del navegador, si lo hay. */
export type ArchivoLocal = { uri: string; nombre: string; tipo: string; file?: Blob };

type Firma = { upload_url?: string; campos?: Record<string, unknown> };

/**
 * Pide la firma a `rutaFirma` (POST, justo antes de subir: vence en una hora), sube el archivo y
 * devuelve su secure_url. Un 503 del backend (Cloudinary sin configurar) sale con `mensajeSinConfigurar`.
 * Lo subido queda en Cloudinary aunque después no se guarde el registro.
 */
export async function subirACloudinary(rutaFirma: string, archivo: ArchivoLocal, mensajeSinConfigurar: string): Promise<string> {
  let firma: Firma;
  try {
    firma = (await authFetch(rutaFirma, { method: 'POST' })) as Firma;
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 503) throw new Error(mensajeSinConfigurar);
    throw e;
  }
  if (!firma.upload_url || !firma.campos) throw new Error('El servidor no devolvió el permiso para subir el archivo.');

  const form = new FormData();
  if (Platform.OS === 'web') {
    // En el navegador la uri es blob: o data:, y FormData necesita el archivo.
    const blob = archivo.file ?? (await (await fetch(archivo.uri)).blob());
    form.append('file', blob, archivo.nombre);
  } else {
    // React Native sube el archivo local a partir de { uri, name, type }.
    form.append('file', { uri: archivo.uri, name: archivo.nombre, type: archivo.tipo } as unknown as Blob);
  }
  for (const [k, v] of Object.entries(firma.campos)) form.append(k, String(v));

  // Sin Content-Type: lo pone fetch con el boundary del multipart.
  const res = await pedirExterno(firma.upload_url, { method: 'POST', body: form });
  const r = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !r.secure_url) throw new Error(r.error?.message ? `No se pudo subir el archivo: ${r.error.message}` : 'No se pudo subir el archivo. Probá de nuevo.');
  return r.secure_url;
}
