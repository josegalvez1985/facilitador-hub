// Los "pintores" de los formularios: cada formulario se dibuja UNA vez contra estas primitivas
// (rectángulo, línea, texto, medir texto, imagen), y de ese dibujo salen el PDF y la imagen.
//
// - PintorPdf (jsPDF): vectorial, en oficio apaisado. Funciona igual en el APK y en la web.
// - PintorSvg: guarda los trazos para dibujarlos con react-native-svg (la vista previa) y de ahí
//   sale la imagen PNG. En el sitio (editorial-ethos-app) la imagen salía de un <canvas>, que en
//   el APK no existe.
//
// Los dos miden el texto con las métricas de Helvetica (o Times) de jsPDF, así el corte de líneas y el
// achicado de letra dan igual en el PDF, la vista previa y la imagen.
//
// Los colores de los formularios son los del papel impreso (fondo blanco), no los del tema de
// la app: por eso van fijos en cada formulario.

import type { jsPDF } from 'jspdf';

/** `serif`: Times (el Acuerdo); sin él, Helvetica (los formularios). */
export type Letra = { tam: number; negrita?: boolean; cursiva?: boolean; color?: string; serif?: boolean };

/** El logo como data URL (JPEG o PNG), con su tamaño natural para no deformarlo. */
export type Logo = { url: string; ancho: number; alto: number };

export interface Pintor {
  /** `grosor`: el del borde, en unidades (el PDF usa siempre 0,15 mm). */
  rect(x: number, y: number, w: number, h: number, fondo: string | null, borde: string | null, grosor?: number): void;
  linea(x1: number, y1: number, x2: number, y2: number, color: string, grosor: number): void;
  /** Alineado a la izquierda; `y` es el CENTRO vertical del texto. */
  texto(s: string, x: number, y: number, l: Letra): void;
  ancho(s: string, l: Letra): number;
  imagen(logo: Logo, x: number, y: number, w: number, h: number): void;
  /** Solo el PDF pagina; la imagen es una sola hoja. */
  nuevaPagina?(): void;
}

export const NEGRO = '#111111';
export const BLANCO = '#ffffff';

/**
 * Texto seguro para la Helvetica de jsPDF (WinAnsi): tildes y eñes sí, pero "—", "→" o "…"
 * saldrían como basura. Se usa también en el SVG para que mida y diga lo mismo.
 */
export function t(s: string): string {
  return s
    .replace(/[–—−]/g, '-')
    .replace(/→/g, '>')
    .replace(/…/g, '...')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^ -ÿ]/g, '?');
}

/* ---- jsPDF, cargado una vez ---------------------------------------------------------------- */

let modulo: Promise<typeof import('jspdf')> | null = null;
let medidor: jsPDF | null = null;

/** Carga jsPDF (import dinámico: en la web no pesa en la carga inicial) y deja listo el medidor. */
export async function cargarJsPdf() {
  modulo ??= import('jspdf');
  const m = await modulo;
  // En puntos: con la letra en "unidades", el ancho sale en esas mismas unidades.
  medidor ??= new m.jsPDF({ unit: 'pt' });
  return m;
}

function fuente(doc: jsPDF, l: Letra, tam: number) {
  doc.setFont(l.serif ? 'times' : 'helvetica', l.negrita && l.cursiva ? 'bolditalic' : l.negrita ? 'bold' : l.cursiva ? 'italic' : 'normal');
  doc.setFontSize(tam);
}

/** El ancho de un texto en unidades, con la Helvetica de jsPDF. Requiere `cargarJsPdf()` antes. */
export function medir(s: string, l: Letra): number {
  if (!medidor) throw new Error('jsPDF no está cargado');
  fuente(medidor, l, l.tam);
  return medidor.getTextWidth(t(s));
}

/* ---- PDF ------------------------------------------------------------------------------------- */

export class PintorPdf implements Pintor {
  constructor(
    private doc: jsPDF,
    /** mm por unidad. */
    private k: number,
    private mx: number,
    private my: number,
  ) {}
  private px = (x: number) => this.mx + x * this.k;
  private py = (y: number) => this.my + y * this.k;
  rect(x: number, y: number, w: number, h: number, fondo: string | null, borde: string | null) {
    if (fondo) this.doc.setFillColor(fondo);
    if (borde) {
      this.doc.setDrawColor(borde);
      this.doc.setLineWidth(0.15);
    }
    const estilo = fondo && borde ? 'FD' : fondo ? 'F' : 'S';
    if (fondo || borde) this.doc.rect(this.px(x), this.py(y), w * this.k, h * this.k, estilo);
  }
  linea(x1: number, y1: number, x2: number, y2: number, color: string, grosor: number) {
    this.doc.setDrawColor(color);
    this.doc.setLineWidth(grosor * this.k);
    this.doc.line(this.px(x1), this.py(y1), this.px(x2), this.py(y2));
  }
  texto(s: string, x: number, y: number, l: Letra) {
    // Unidades → mm → puntos.
    fuente(this.doc, l, (l.tam * this.k) / 0.3528);
    this.doc.setTextColor(l.color ?? NEGRO);
    this.doc.text(t(s), this.px(x), this.py(y), { baseline: 'middle' });
  }
  ancho(s: string, l: Letra) {
    return medir(s, l);
  }
  imagen(logo: Logo, x: number, y: number, w: number, h: number) {
    // JPEG: jsPDF lo inserta tal cual. Un PNG lo decodifica y recomprime en JavaScript (lento en el APK).
    this.doc.addImage(logo.url, logo.url.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', this.px(x), this.py(y), w * this.k, h * this.k);
  }
  nuevaPagina() {
    this.doc.addPage();
  }
}

/* ---- SVG (vista previa e imagen) ------------------------------------------------------------- */

export type Trazo =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fondo: string | null; borde: string | null; grosor: number }
  | { k: 'linea'; x1: number; y1: number; x2: number; y2: number; color: string; grosor: number }
  | { k: 'texto'; s: string; x: number; y: number; tam: number; negrita: boolean; cursiva: boolean; serif: boolean; color: string; ancho: number }
  | { k: 'imagen'; url: string; x: number; y: number; w: number; h: number };

/** Una hoja dibujada: sus trazos y su tamaño en unidades. */
export type Lamina = { ancho: number; alto: number; trazos: Trazo[] };

export class PintorSvg implements Pintor {
  trazos: Trazo[] = [];
  rect(x: number, y: number, w: number, h: number, fondo: string | null, borde: string | null, grosor = 1) {
    if (fondo || borde) this.trazos.push({ k: 'rect', x, y, w, h, fondo, borde, grosor });
  }
  linea(x1: number, y1: number, x2: number, y2: number, color: string, grosor: number) {
    this.trazos.push({ k: 'linea', x1, y1, x2, y2, color, grosor });
  }
  texto(s: string, x: number, y: number, l: Letra) {
    const limpio = t(s);
    if (!limpio.trim()) return;
    this.trazos.push({ k: 'texto', s: limpio, x, y, tam: l.tam, negrita: !!l.negrita, cursiva: !!l.cursiva, serif: !!l.serif, color: l.color ?? NEGRO, ancho: medir(limpio, l) });
  }
  ancho(s: string, l: Letra) {
    return medir(s, l);
  }
  imagen(logo: Logo, x: number, y: number, w: number, h: number) {
    this.trazos.push({ k: 'imagen', url: logo.url, x, y, w, h });
  }
}
