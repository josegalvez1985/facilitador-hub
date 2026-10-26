// Las salidas de los formularios: el PDF y la imagen PNG.
//
// - APK: se guardan en la caché de la app y se abre el menú de compartir del sistema (abrir con
//   un visor de PDF, guardar, mandar por WhatsApp…). La imagen la dibuja el WebView de la vista
//   previa (hoja-nativa.tsx), fuera del hilo principal.
// - Web / PWA: se abren en una pestaña nueva; si el navegador no la deja abrir, se descargan.
//   La pestaña se abre DENTRO del toque (antes de cualquier await), porque después el navegador
//   la bloquea como ventana emergente.

import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { cargarJsPdf, type Lamina, type Logo } from './pintor';
import type { Documento } from './planilla';
import { svgMarkup, tamanoLamina } from './vista';

/** La imagen sale de ~2800 px de ancho, como en el sitio. */
const ANCHO_IMAGEN = 2800;

export function pixelesImagen(l: Lamina) {
  const t = tamanoLamina(l);
  const escala = Math.min(2, ANCHO_IMAGEN / t.ancho);
  return { ancho: Math.round(t.ancho * escala), alto: Math.round(t.alto * escala) };
}

/** Un respiro antes del trabajo pesado, para que la pantalla alcance a mostrar "Generando…". */
const respiro = () => new Promise((ok) => setTimeout(ok, 50));

/* ---- El logo (el de public/logo.png, el mismo del sitio) ------------------------------------- */

let logo: Promise<Logo | null> | null = null;

/**
 * El logo como data URL. null si no se pudo leer: el formulario sale igual, sin él. Es una copia
 * JPEG de 200 px de public/logo.png: jsPDF la inserta sin decodificarla (con el PNG de 512 px el
 * PDF del Form. 2 tardaba segundos en el APK y pesaba 1 MB).
 */
export function cargarLogo(): Promise<Logo | null> {
  logo ??= (async () => {
    try {
      const a = Asset.fromModule(require('../../../assets/images/logo-formularios.jpg'));
      await a.downloadAsync();
      let url: string;
      if (Platform.OS === 'web') {
        const blob = await (await fetch(a.uri)).blob();
        url = await new Promise<string>((ok, mal) => {
          const fr = new FileReader();
          fr.onload = () => ok(String(fr.result));
          fr.onerror = () => mal(fr.error);
          fr.readAsDataURL(blob);
        });
      } else {
        url = `data:image/jpeg;base64,${await new File(a.localUri ?? a.uri).base64()}`;
      }
      return { url, ancho: a.width ?? 200, alto: a.height ?? 200 };
    } catch {
      return null;
    }
  })();
  return logo;
}

/* ---- Web: pestaña nueva o descarga ------------------------------------------------------------ */

function abrirEnPestana(generar: () => Promise<Blob>, archivo: string, que: string): Promise<void> {
  const pestana = window.open('', '_blank');
  if (pestana) {
    try {
      pestana.document.title = 'Generando…';
      pestana.document.body.innerHTML = `<p style="font:14px system-ui,sans-serif;color:#555;padding:32px">Generando ${que}…</p>`;
    } catch {
      /* algunos navegadores no dejan escribir en la pestaña: no importa */
    }
  }
  return generar().then(
    (blob) => {
      const url = URL.createObjectURL(blob);
      if (pestana && !pestana.closed) {
        pestana.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = archivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // Largo a propósito: si se revoca antes de que la pestaña cargue, el visor da error.
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    },
    (e: unknown) => {
      pestana?.close();
      throw e;
    },
  );
}

function imagenWeb(l: Lamina): Promise<Blob> {
  const { ancho, alto } = pixelesImagen(l);
  return new Promise((ok, mal) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext('2d');
      if (!ctx) return mal(new Error('El navegador no puede dibujar la imagen'));
      ctx.drawImage(img, 0, 0, ancho, alto);
      canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen'))), 'image/png');
    };
    img.onerror = () => mal(new Error('No se pudo generar la imagen'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup(l, ancho, alto))}`;
  });
}

/* ---- APK: archivo en la caché y menú de compartir --------------------------------------------- */

async function compartir(base64: string, nombre: string, mimeType: string, UTI: string) {
  const f = new File(Paths.cache, nombre);
  if (f.exists) f.delete();
  f.create();
  await f.write(base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos');
  await Sharing.shareAsync(f.uri, { mimeType, UTI, dialogTitle: nombre });
}

/* ---- Lo que llama la pantalla ----------------------------------------------------------------- */

/** El PDF del documento. En la web, llamarla dentro del toque y sin await previo. */
export function sacarPdf(d: Documento): Promise<void> {
  const nombre = `${d.archivo}.pdf`;
  if (Platform.OS === 'web') return abrirEnPestana(async () => d.pdf(await cargarJsPdf()).output('blob'), nombre, 'el PDF');
  return (async () => {
    const m = await cargarJsPdf();
    await respiro();
    const doc = d.pdf(m);
    const uri = doc.output('datauristring');
    await compartir(uri.slice(uri.indexOf(',') + 1), nombre, 'application/pdf', 'com.adobe.pdf');
  })();
}

/**
 * La imagen PNG de la hoja. En el APK la dibuja el WebView de la vista previa (`rasterizar`); en
 * la web, el navegador con el mismo SVG. En la web, llamarla dentro del toque y sin await previo.
 */
export function sacarImagen(d: Documento, lamina: Lamina, rasterizar?: () => Promise<string>): Promise<void> {
  const nombre = `${d.archivo}.png`;
  if (Platform.OS === 'web') return abrirEnPestana(() => imagenWeb(lamina), nombre, 'la imagen');
  return (async () => {
    if (!rasterizar) throw new Error('La vista previa todavía no está lista');
    await respiro();
    await compartir(await rasterizar(), nombre, 'image/png', 'public.png');
  })();
}
