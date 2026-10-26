// El motor de las planillas con formato del Form. 2 y el Form. 3, copiado de editorial-ethos-app
// (src/lib/planilla-celdas.ts, 26/10/2026) sin la salida a Excel: una grilla de columnas y filas
// con celdas que pueden unir varias (como Excel). De la grilla salen el PDF y la imagen, que así
// no se pueden desincronizar. Las medidas son "unidades": el PDF las escala al ancho de la hoja.

import type { jsPDF } from 'jspdf';

import { NEGRO, PintorPdf, PintorSvg, type Lamina, type Letra, type Logo, type Pintor } from './pintor';

/** Lo que cada formulario entrega a la pantalla: su nombre de archivo, la imagen y el PDF. */
export type Documento = {
  /** "Form. 2 - Institución - Facilitador - 01-10-2026 al 31-10-2026" (sin extensión). */
  archivo: string;
  /** La vista previa y la imagen: una sola hoja, del alto que haga falta. */
  lamina(): Lamina;
  /** El PDF en oficio apaisado. Requiere `cargarJsPdf()` antes. */
  pdf(m: typeof import('jspdf')): jsPDF;
};

const C = { borde: '#3f3f3f' };

/** Tamaño de letra de base (unidades). */
const T = 12;

/* ---- La grilla ------------------------------------------------------------------------------- */

/** Un tramo de texto con su propio estilo (un título con una parte en rojo). */
export type Parte = { t: string; tinta?: string; subrayado?: boolean; negrita?: boolean };

export type Estilo = {
  tam?: number;
  negrita?: boolean;
  cursiva?: boolean;
  tinta?: string;
  fondo?: string;
  alinear?: 'left' | 'center' | 'right';
  /** Varias líneas: corta por palabras y achica la letra hasta que entre. */
  multilinea?: boolean;
  /** Las letras una debajo de otra (los manuales del encabezado). */
  vertical?: boolean;
  sinBorde?: boolean;
  /** Solo en el dibujo (el marco de las firmas). */
  soloDibujo?: boolean;
};

export type Celda = Estilo & { f: number; c: number; nf: number; nc: number; texto: string | Parte[] };

export type Planilla = {
  anchos: number[];
  altos: number[];
  celdas: Celda[];
  /** Dónde va el logo (un rango de celdas); sin él, la planilla no lleva logo. */
  logo?: { f: number; c: number; nf: number; nc: number };
};

const textoPlano = (x: string | Parte[]) => (typeof x === 'string' ? x : x.map((p) => p.t).join(''));

/**
 * Una grilla nueva con sus columnas (`[clave, ancho]`, en orden):
 * - `fila(alto)`: agrega una fila y devuelve su número; `cuantas()`, cuántas hay;
 * - `poner(f, desde, hasta, texto, estilo, nf)`: una celda de la columna `desde` a `hasta`
 *   (claves) y de `nf` filas desde la `f`;
 * - `terminar(logo)`: la planilla lista para las salidas.
 */
export function nuevaPlanilla(columnas: [string, number][]) {
  const col = new Map(columnas.map(([k], i) => [k, i]));
  const altos: number[] = [];
  const celdas: Celda[] = [];
  return {
    fila: (alto: number) => altos.push(alto) - 1,
    cuantas: () => altos.length,
    poner: (f: number, desde: string, hasta: string, texto: Celda['texto'], e: Estilo = {}, nf = 1) => {
      const c = col.get(desde) ?? 0;
      celdas.push({ f, c, nf, nc: (col.get(hasta) ?? c) - c + 1, texto, ...e });
    },
    terminar: (logo?: Planilla['logo']): Planilla => ({ anchos: columnas.map(([, a]) => a), altos, celdas, logo }),
  };
}

/* ---- El dibujo ------------------------------------------------------------------------------- */

/** Las posiciones de cada columna y fila (una más al final: el borde). */
function medidas(pl: Planilla) {
  const xs = [0];
  for (const a of pl.anchos) xs.push(xs[xs.length - 1]! + a);
  const ys = [0];
  for (const a of pl.altos) ys.push(ys[ys.length - 1]! + a);
  return { xs, ys, ancho: xs[xs.length - 1]!, alto: ys[ys.length - 1]! };
}

/** Corta un texto en líneas que entren en `w` con esa letra. */
function partir(p: Pintor, s: string, w: number, l: Letra): string[] {
  const lineas: string[] = [];
  for (const parrafo of s.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (actual && p.ancho(prueba, l) > w) {
        lineas.push(actual);
        actual = palabra;
      } else actual = prueba;
    }
    lineas.push(actual);
  }
  return lineas;
}

function dibujar(p: Pintor, pl: Planilla, logo: Logo | null) {
  const { xs, ys } = medidas(pl);

  for (const c of pl.celdas) {
    const x = xs[c.c]!;
    const y = ys[c.f]!;
    const w = xs[c.c + c.nc]! - x;
    const h = ys[c.f + c.nf]! - y;
    p.rect(x, y, w, h, c.fondo ?? null, c.sinBorde ? null : C.borde);

    const base: Letra = { tam: c.tam ?? T, negrita: c.negrita, cursiva: c.cursiva, color: c.tinta ?? NEGRO };
    const libre = w - 8;
    const alinear = c.alinear ?? 'center';
    const xDe = (ancho: number) => (alinear === 'left' ? x + 4 : alinear === 'right' ? x + w - 4 - ancho : x + (w - ancho) / 2);

    if (c.vertical) {
      const letras = [...textoPlano(c.texto)];
      let tam = base.tam;
      while (tam > 6 && letras.length * tam * 1.05 > h - 4) tam -= 0.5;
      const alto = tam * 1.05;
      letras.forEach((ch, i) => {
        const l = { ...base, tam };
        p.texto(ch, x + (w - p.ancho(ch, l)) / 2, y + (h - letras.length * alto) / 2 + alto * (i + 0.5), l);
      });
      continue;
    }

    if (c.multilinea) {
      const s = textoPlano(c.texto);
      if (!s) continue;
      let l = base;
      let lineas = partir(p, s, libre, l);
      while (l.tam > base.tam * 0.5 && lineas.length * l.tam * 1.18 > h - 4) {
        l = { ...l, tam: l.tam - 0.5 };
        lineas = partir(p, s, libre, l);
      }
      const alto = l.tam * 1.18;
      lineas.forEach((ln, i) => p.texto(ln, xDe(p.ancho(ln, l)), y + (h - lineas.length * alto) / 2 + alto * (i + 0.5), l));
      continue;
    }

    // Una línea, con tramos: se achica hasta 3/5 y si no entra, se corta.
    const partes: Parte[] = typeof c.texto === 'string' ? [{ t: c.texto }] : c.texto;
    if (!partes.some((q) => q.t)) continue;
    // jsPDF no mide los espacios de las puntas: van aparte, como un hueco.
    const medirPartes = (l: Letra) => {
      const hueco = p.ancho('0', l) * 0.8;
      let total = 0;
      const piezas = partes.map((q, i) => {
        const lq = { ...l, negrita: q.negrita ?? l.negrita, color: q.tinta ?? l.color };
        const antes = i > 0 && (q.t.startsWith(' ') || partes[i - 1]!.t.endsWith(' ')) ? hueco : 0;
        const ancho = p.ancho(q.t.trim(), lq);
        total += antes + ancho;
        return { ...q, s: q.t.trim(), l: lq, antes, ancho };
      });
      return { piezas, total };
    };
    let l = base;
    let m = medirPartes(l);
    while (l.tam > base.tam * 0.6 && m.total > libre) {
      l = { ...l, tam: l.tam - 0.5 };
      m = medirPartes(l);
    }
    if (m.total > libre && m.piezas.length === 1) {
      const unica = m.piezas[0]!;
      let s = unica.s;
      while (s.length > 1 && p.ancho(`${s}…`, unica.l) > libre) s = s.slice(0, -1);
      m.piezas[0] = { ...unica, s: `${s}…`, ancho: p.ancho(`${s}…`, unica.l) };
      m.total = m.piezas[0].ancho;
    }
    let px = xDe(m.total);
    const cy = y + h / 2;
    for (const q of m.piezas) {
      px += q.antes;
      p.texto(q.s, px, cy, q.l);
      if (q.subrayado) {
        const yy = cy + q.l.tam * 0.55;
        p.linea(px, yy, px + q.ancho, yy, q.l.color ?? NEGRO, Math.max(1, q.l.tam / 14));
      }
      px += q.ancho;
    }
  }

  // El logo, centrado en su lugar y sin deformar.
  if (logo && pl.logo) {
    const { f, c, nf, nc } = pl.logo;
    const x = xs[c]!;
    const y = ys[f]!;
    const w = xs[c + nc]! - x;
    const h = ys[f + nf]! - y;
    const r = Math.min((w - 6) / logo.ancho, (h - 6) / logo.alto);
    const lw = logo.ancho * r;
    const lh = logo.alto * r;
    p.imagen(logo, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
  }
}

/* ---- Salidas --------------------------------------------------------------------------------- */

/** La planilla como documento: el PDF en oficio apaisado en UNA hoja (se achica si no entra). */
export function documentoPlanilla(pl: Planilla, archivo: string, logo: Logo | null): Documento {
  return {
    archivo,
    lamina: () => {
      const p = new PintorSvg();
      dibujar(p, pl, logo);
      const { ancho, alto } = medidas(pl);
      return { ancho, alto, trazos: p.trazos };
    },
    pdf: ({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
      // El título que muestra el visor ("Form. 2 - …").
      doc.setProperties({ title: archivo });
      doc.viewerPreferences({ DisplayDocTitle: true });
      const margen = 6;
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const { ancho, alto } = medidas(pl);
      const k = Math.min((W - 2 * margen) / ancho, (H - 2 * margen) / alto);
      dibujar(new PintorPdf(doc, k, (W - ancho * k) / 2, margen), pl, logo);
      return doc;
    },
  };
}
