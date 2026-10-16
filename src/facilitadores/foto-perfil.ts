import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Foto de perfil: vive solo en este dispositivo (AsyncStorage = localStorage en la PWA), no en el backend.
 * La clave lleva el usuario: en un equipo compartido cada usuario ve solo su foto.
 */
const clave = (usuario: string) => `facilitadores.foto.${usuario}`;

/** Lado en px: chico para no llenar el localStorage (~5 MB) y alcanza para el avatar más grande. */
const LADO = 256;

export async function leerFoto(usuario: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(clave(usuario));
  } catch {
    return null;
  }
}

export async function guardarFoto(usuario: string, uri: string | null) {
  if (uri) await AsyncStorage.setItem(clave(usuario), uri);
  else await AsyncStorage.removeItem(clave(usuario));
}

/** Abre la galería y devuelve la foto como data URI JPEG cuadrada de LADO px, o null si se cancela. */
export async function elegirFoto(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = r.canceled ? undefined : r.assets?.[0];
  if (!asset) return null;
  const { uri, width, height } = asset;

  const ctx = ImageManipulator.manipulate(uri);
  // La PWA no tiene editor de recorte: se toma el cuadrado central.
  const lado = Math.min(width, height);
  if (lado > 0 && width !== height) {
    ctx.crop({ originX: Math.floor((width - lado) / 2), originY: Math.floor((height - lado) / 2), width: lado, height: lado });
  }
  ctx.resize({ width: LADO, height: LADO });
  const imagen = await ctx.renderAsync();
  const res = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!res.base64) throw new Error('No se pudo leer la imagen.');
  return `data:image/jpeg;base64,${res.base64}`;
}
