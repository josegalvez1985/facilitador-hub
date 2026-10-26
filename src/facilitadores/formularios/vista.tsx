// La hoja de un formulario dibujada en SVG. `LaminaSvg` (react-native-svg) es la vista previa en
// la web; `svgMarkup` es el mismo dibujo como texto SVG, del que salen la imagen PNG de la web y,
// en el APK, la vista previa y la imagen (hoja-nativa.tsx). Lo que se ve es lo que se descarga.

import type { Ref } from 'react';
import Svg, { Image as SvgImage, Line, Rect, Text as SvgText } from 'react-native-svg';

import { BLANCO, type Lamina, type Trazo } from './pintor';

/** Margen blanco alrededor del dibujo, en unidades. */
export const PAD = 12;

/** De `y` (centro del texto) a la línea de base: la mitad de la caja de Helvetica. */
const BASE = 0.34;

const FUENTE = 'Helvetica, Arial, sans-serif';

export const tamanoLamina = (l: Lamina) => ({ ancho: l.ancho + 2 * PAD, alto: l.alto + 2 * PAD });

/**
 * La hoja a `ancho` píxeles de pantalla. Cada texto lleva `textLength` (el ancho medido con
 * jsPDF), así ocupa lo mismo que en el PDF aunque el sistema no tenga Helvetica.
 */
export function LaminaSvg({ lamina, ancho, ref }: { lamina: Lamina; ancho: number; ref?: Ref<Svg> }) {
  const t = tamanoLamina(lamina);
  return (
    <Svg ref={ref} width={ancho} height={(ancho * t.alto) / t.ancho} viewBox={`${-PAD} ${-PAD} ${t.ancho} ${t.alto}`}>
      <Rect x={-PAD} y={-PAD} width={t.ancho} height={t.alto} fill={BLANCO} />
      {lamina.trazos.map((tr, i) => (
        <TrazoSvg key={i} tr={tr} />
      ))}
    </Svg>
  );
}

function TrazoSvg({ tr }: { tr: Trazo }) {
  switch (tr.k) {
    case 'rect':
      return <Rect x={tr.x} y={tr.y} width={tr.w} height={tr.h} fill={tr.fondo ?? 'none'} stroke={tr.borde ?? 'none'} strokeWidth={tr.borde ? tr.grosor : 0} />;
    case 'linea':
      return <Line x1={tr.x1} y1={tr.y1} x2={tr.x2} y2={tr.y2} stroke={tr.color} strokeWidth={tr.grosor} />;
    case 'texto':
      return (
        <SvgText
          x={tr.x}
          y={tr.y + tr.tam * BASE}
          fontSize={tr.tam}
          fontFamily={FUENTE}
          fontWeight={tr.negrita ? 'bold' : 'normal'}
          fontStyle={tr.cursiva ? 'italic' : 'normal'}
          fill={tr.color}
          textLength={tr.ancho}
          lengthAdjust="spacingAndGlyphs">
          {tr.s}
        </SvgText>
      );
    case 'imagen':
      return <SvgImage x={tr.x} y={tr.y} width={tr.w} height={tr.h} href={tr.url} preserveAspectRatio="none" />;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(Math.round(v * 100) / 100);

/** El mismo dibujo como texto SVG, a `ancho` × `alto` píxeles (la imagen de la web). */
export function svgMarkup(lamina: Lamina, ancho: number, alto: number): string {
  const t = tamanoLamina(lamina);
  const partes = lamina.trazos.map((tr) => {
    switch (tr.k) {
      case 'rect':
        return `<rect x="${n(tr.x)}" y="${n(tr.y)}" width="${n(tr.w)}" height="${n(tr.h)}" fill="${tr.fondo ?? 'none'}" stroke="${tr.borde ?? 'none'}" stroke-width="${tr.borde ? n(tr.grosor) : 0}"/>`;
      case 'linea':
        return `<line x1="${n(tr.x1)}" y1="${n(tr.y1)}" x2="${n(tr.x2)}" y2="${n(tr.y2)}" stroke="${tr.color}" stroke-width="${n(tr.grosor)}"/>`;
      case 'texto':
        return `<text x="${n(tr.x)}" y="${n(tr.y + tr.tam * BASE)}" font-size="${n(tr.tam)}" font-family="${FUENTE}" font-weight="${tr.negrita ? 'bold' : 'normal'}" font-style="${tr.cursiva ? 'italic' : 'normal'}" fill="${tr.color}" textLength="${n(tr.ancho)}" lengthAdjust="spacingAndGlyphs">${esc(tr.s)}</text>`;
      case 'imagen':
        return `<image x="${n(tr.x)}" y="${n(tr.y)}" width="${n(tr.w)}" height="${n(tr.h)}" href="${tr.url}" preserveAspectRatio="none"/>`;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="${-PAD} ${-PAD} ${n(t.ancho)} ${n(t.alto)}">` +
    `<rect x="${-PAD}" y="${-PAD}" width="${n(t.ancho)}" height="${n(t.alto)}" fill="${BLANCO}"/>${partes.join('')}</svg>`
  );
}
