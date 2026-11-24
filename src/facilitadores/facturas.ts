// "Mis facturas": el facilitador sube la foto de su factura y carga el número, el timbrado, la
// fecha y el mes; el administrador la controla desde "Totales por Facilitador" del sitio
// editorial-ethos-app. Endpoints mis-facturas/* (sql/facturas_app_ethos.sql →
// PKG_FACTURAS_APP_ETHOS), con el ID_FACILITADOR sacado del token en el servidor. Misma tabla y
// reglas que el sitio (FACTURAS_FACILITADORES): una factura por mes, el número no se repite con
// el mismo timbrado.
// - Por revisar = CANTIDAD 0 (la app nunca ve cantidad, sueldo ni monto). Revisada, ya no se toca.
// - La foto va DIRECTO a Cloudinary con la firma de mis-facturas/firma-foto (preset Signed: el
//   secreto queda en Oracle) y su secure_url se guarda como foto_url. Sin lectura con IA.

import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { authFetch, ErrorApi, filasDe } from './auth/api';
import { subirACloudinary } from './cloudinary';
import { hoy } from './fechas';
import { ErrorDeCampo } from './intervenciones';

export type Factura = {
  id: number;
  /** Siempre 001-001-0000123: el backend lo normaliza. */
  nroFactura: string;
  timbrado: string;
  /** YYYY-MM-DD */
  fechaFactura: string;
  anio: number;
  /** 1 a 12 */
  mes: number;
  fotoUrl: string;
  revisada: boolean;
  /** YYYY-MM-DDTHH:MI, hora de Paraguay, o "". */
  cargadoEl: string;
};

export type ListaFacturas = { facturas: Factura[]; fotosHabilitadas: boolean };

/** foto_url "" en una corrección deja la foto que había. */
export type DatosFactura = { nro_factura: string; timbrado: string; fecha_factura: string; anio: number; mes: number; foto_url: string };

/** La foto lista para subir, ya achicada. */
export type FotoLocal = { uri: string; ancho: number; alto: number };

/** Primer año que acepta el backend (c_anio_minimo). */
export const ANIO_MINIMO = 2024;
export const LARGO_TIMBRADO = 20;

export const FALTA_PUBLICAR = 'Falta publicar en el backend los endpoints de mis-facturas (sql/facturas_app_ethos.sql).';
/** Un endpoint sin publicar: ORDS responde "Not Found" (los 404 del paquete vienen en castellano). */
export const faltaPublicar = (mensaje: string) => /not found/i.test(mensaje);

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const n = (v: unknown) => Number(v ?? 0) || 0;

export async function listarFacturas(): Promise<ListaFacturas> {
  const r = (await authFetch('mis-facturas')) as { fotos_habilitadas?: unknown };
  return {
    fotosHabilitadas: r.fotos_habilitadas === true,
    facturas: filasDe(r).map((f) => ({
      id: n(f.id_factura),
      nroFactura: s(f.nro_factura),
      timbrado: s(f.timbrado),
      fechaFactura: s(f.fecha_factura),
      anio: n(f.anio),
      mes: n(f.mes),
      fotoUrl: s(f.foto_url),
      revisada: f.revisada === true,
      cargadoEl: s(f.cargado_el),
    })),
  };
}

/** Alta (`id` null) o corrección. Una validación del servidor llega como ErrorDeCampo. */
export async function guardarFactura(id: number | null, datos: DatosFactura): Promise<void> {
  try {
    await authFetch(id === null ? 'mis-facturas' : `mis-facturas/${encodeURIComponent(id)}`, {
      method: id === null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  } catch (e) {
    if (e instanceof ErrorApi && typeof e.datos.campo === 'string') throw new ErrorDeCampo(e.message, e.datos.campo);
    throw e;
  }
}

/** Sin cuerpo ni Content-Type: ORDS responde 400 a un DELETE con JSON vacío. */
export async function eliminarFactura(id: number): Promise<void> {
  await authFetch(`mis-facturas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------------- */
/* La foto                                                                   */
/* ------------------------------------------------------------------------- */

/** Tope del archivo que se sube a Cloudinary. */
const TOPE_BYTES = 3 * 1024 * 1024;

/**
 * De la más nítida a la más liviana (lado más largo en px y calidad JPEG): se queda con la
 * primera que entra en el tope. 4000 px es la foto entera de un celular de 12 MP; la última
 * pesa menos de 1 MB y se usa siempre, aunque ninguna anterior haya entrado.
 */
const INTENTOS = [
  { lado: 4000, calidad: 0.9 },
  { lado: 3200, calidad: 0.85 },
  { lado: 2600, calidad: 0.8 },
  { lado: 2000, calidad: 0.75 },
  { lado: 1600, calidad: 0.7 },
];

/** Bytes del archivo a partir de su base64 (con o sin el prefijo data:). */
function bytesDeBase64(base64: string): number {
  const b = base64.slice(base64.indexOf(',') + 1);
  const relleno = b.endsWith('==') ? 2 : b.endsWith('=') ? 1 : 0;
  return Math.floor((b.length * 3) / 4) - relleno;
}

/**
 * Saca una foto con la cámara o la elige de la galería, y la devuelve como JPEG de hasta 3 MB,
 * lo más nítida que entre. null si se cancela. En la PWA, "cámara" abre la cámara del celular
 * (o el selector de archivos en una computadora).
 */
export async function tomarFoto(origen: 'camara' | 'galeria'): Promise<FotoLocal | null> {
  if (origen === 'camara' && Platform.OS !== 'web') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) throw new Error('Permití el acceso a la cámara para sacar la foto, o elegila de la galería.');
  }
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
  const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  const asset = r.canceled ? undefined : r.assets?.[0];
  if (!asset) return null;

  const { width, height } = asset;
  let foto: FotoLocal | null = null;
  for (const { lado, calidad } of INTENTOS) {
    // Si la foto ya es más chica que este lado, solo cambia la calidad: nunca se agranda.
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (Math.max(width, height) > lado) ctx.resize(width >= height ? { width: lado } : { height: lado });
    const imagen = await ctx.renderAsync();
    const res = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: calidad, base64: true });
    foto = { uri: res.uri, ancho: res.width, alto: res.height };
    if (res.base64 && bytesDeBase64(res.base64) <= TOPE_BYTES) break;
  }
  return foto;
}

/**
 * Sube la foto a Cloudinary y devuelve su secure_url. La firma vence en una hora: se pide
 * justo antes de subir. Lo subido queda en Cloudinary aunque después no se guarde la factura.
 */
export function subirFoto(foto: FotoLocal): Promise<string> {
  return subirACloudinary('mis-facturas/firma-foto', { uri: foto.uri, nombre: 'factura.jpg', tipo: 'image/jpeg' }, 'Todavía no se pueden subir fotos. Avisale a la coordinación.');
}

/** Si el enlace es de un PDF (el administrador puede cargar la factura electrónica desde el sitio). */
export const esPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

/**
 * Una versión liviana con una transformación de Cloudinary en el mismo enlace: la foto achicada,
 * o la primera página del PDF como imagen. Si el enlace no es de Cloudinary, el original.
 */
export function miniatura(url: string, lado = 320): string {
  if (!url.includes('/upload/')) return url;
  const t = esPdf(url) ? `c_limit,w_${lado},h_${lado},pg_1,f_jpg,q_auto` : `c_limit,w_${lado},h_${lado},f_auto,q_auto`;
  const conTransformacion = url.replace('/upload/', `/upload/${t}/`);
  return esPdf(url) ? conTransformacion.replace(/\.pdf(\?|$)/i, '.jpg$1') : conTransformacion;
}

/* ------------------------------------------------------------------------- */
/* Número, fechas y mes                                                      */
/* ------------------------------------------------------------------------- */

/** Largo de cada parte del número: 001-001-0001235. */
const PARTES_NRO = [3, 3, 7];

/**
 * Mientras se tipea el número: con o sin guiones queda 001-001-0001235.
 * - Solo números: el guion se pone solo al pasar el 3.º y el 6.º dígito ("0010010001235").
 * - Con guiones: se respetan, así se puede escribir corto ("1-1-1235"); al salir del campo
 *   formatearNroFactura completa los ceros.
 * - El guion automático aparece recién con el dígito siguiente, así borrar hacia atrás
 *   funciona normal. Uno escrito por el usuario se muestra enseguida, para seguir tipeando.
 */
export function mascaraNroFactura(texto: string): string {
  const partes = [''];
  for (const ch of texto) {
    const i = partes.length - 1;
    const actual = partes[i] ?? '';
    if (ch === '-') {
      // Un guion cierra la parte actual (si tiene algo y quedan partes).
      if (actual && partes.length < PARTES_NRO.length) partes.push('');
    } else if (/\d/.test(ch)) {
      if (actual.length < (PARTES_NRO[i] ?? 0)) partes[i] = actual + ch;
      else if (partes.length < PARTES_NRO.length) partes.push(ch); // parte llena: guion automático
    }
  }
  return partes.join('-');
}

/**
 * 001-001-0000123, o null si no se puede llevar a ese formato. La misma regla que f_nro_factura
 * del backend: los 13 dígitos juntos o cada parte sin sus ceros a la izquierda (1-1-123).
 */
export function formatearNroFactura(texto: string): string | null {
  const v = texto.replace(/\s+/g, '');
  if (/^\d{13}$/.test(v)) return `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`;
  const m = /^(\d{1,3})-(\d{1,3})-(\d{1,7})$/.exec(v);
  if (!m) return null;
  const [, a = '', b = '', c = ''] = m;
  return `${a.padStart(3, '0')}-${b.padStart(3, '0')}-${c.padStart(7, '0')}`;
}

const dos = (x: number) => String(x).padStart(2, '0');

/** Date → YYYY-MM-DD (fecha local del dispositivo). */
export const aIso = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** YYYY-MM-DD → DD/MM/AAAA */
export const isoADma = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** Si el mes todavía no empezó (el backend no lo acepta). */
export const mesFuturo = (anio: number, mes: number) => {
  const h = hoy();
  return anio > h.getFullYear() || (anio === h.getFullYear() && mes > h.getMonth() + 1);
};

/** El mes que se propone para una factura nueva: el más reciente que todavía no tiene factura. */
export function mesSugerido(facturas: Factura[]): { anio: number; mes: number } {
  const h = hoy();
  for (let i = 0; i < 12; i++) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    if (anio < ANIO_MINIMO) break;
    if (!facturas.some((f) => f.anio === anio && f.mes === mes)) return { anio, mes };
  }
  return { anio: h.getFullYear(), mes: h.getMonth() + 1 };
}
