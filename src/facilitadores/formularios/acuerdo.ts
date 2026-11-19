// El "Acuerdo específico de cooperación" entre la Editorial Ethos y una institución, a partir del
// modelo "7 MODELO ACUERDO IE PDF.pdf" (A4 vertical, Times New Roman, dos hojas). Solo en PDF.
//
// Los datos salen de GET mis-formularios/institucion (sql/formularios_app_ethos.sql): el nombre de
// la institución y su director/a del período (nombre, CI y teléfono). El servidor responde solo
// por instituciones donde el facilitador del token tiene clases ese año, así que un facilitador
// nunca saca el acuerdo de una institución ajena. Lo que falta sale como línea en blanco, igual
// que en el modelo, para completarlo a mano. La fecha del Convenio Marco con el MEC queda en
// blanco, como en el modelo.
//
// El texto va justificado, con partes en negrita (**así**) y subrayadas (~~así~~), y se corta en
// hojas A4. La vista previa es el mismo dibujo con las hojas una debajo de la otra.

import type { Autoridad, Formulario } from './datos';
import { limpio } from './listas';
import { NEGRO, PintorPdf, PintorSvg, type Letra, type Logo, type Pintor } from './pintor';
import type { Documento } from './planilla';

/** A4 en puntos (la unidad del dibujo). */
const HOJA = { ancho: 595.25, alto: 842 };
const MARGEN = { izq: 50, der: 32, arriba: 34, abajo: 40 };
const ANCHO_TEXTO = HOJA.ancho - MARGEN.izq - MARGEN.der;
/** Entre hoja y hoja, en la vista previa. */
const SEPARACION = 16;

const TAM = 10;
const INTERLINEA = 11.6;
const ENTRE_PARRAFOS = 7;

/* ---- El texto del modelo ----------------------------------------------------------------------- */

/** Lo que se completa con los datos (o con una línea en blanco). */
type Datos = { institucion: string; director: string; ci: string; telefono: string; anio: string };

const BLANCO_CORTO = '_______';
const BLANCO_LARGO = '_____________';

/** Los párrafos del modelo. `{clave}` se completa con `Datos`. */
const PARRAFOS: { texto: string; titulo?: boolean }[] = [
  {
    texto:
      'El presente acuerdo específico es celebrado entre {institucion}, representado/a por {director} en su carácter de Director/a, con cédula de identidad civil número {ci}, en adelante denominado/a LA INSTITUCIÓN, y la EDITORIAL ETHOS, representada en este acto, por el Señor Santiago Monti, en su carácter de Presidente, con cédula de identidad civil número 685944, en adelante denominada LA EDITORIAL. Los intervinientes, que actúan en razón de sus respectivos cargos, se reconocen mutua y recíprocamente la capacidad legal necesaria para la formalización del presente documento y, en su mérito, resuelven acordar las siguientes cláusulas y condiciones:',
  },
  { texto: '**CLÁUSULA PRIMERA - Del objeto del acuerdo**:', titulo: true },
  {
    texto:
      '**Artículo 1:** El presente acuerdo tiene por objeto regular el marco de la colaboración entre LA EDITORIAL y LA INSTITUCIÓN, con relación al Proyecto "JUVENTUD CON VALORES", durante el año académico {anio}.',
  },
  { texto: '**Artículo 2:** El año académico, a los efectos de este acuerdo, abarca 8 meses, de marzo a octubre del año {anio}.' },
  { texto: '**CLÁUSULA SEGUNDA - De las condiciones del acuerdo - Obligaciones de LA EDITORIAL:**', titulo: true },
  {
    texto:
      '**Artículo 3:** La EDITORIAL se COMPROMETE a proveer a LA INSTITUCION en formato digital y a través del grupo (WhatsApp) de la Cooperación, los siguientes documentos: la descripción del Proyecto Juventud con Valores, el Convenio Marco de Cooperación Interinstitucional con el Ministerio de Educación y Ciencias vigente hasta el ___ de _________ del 20___, las Resoluciones N° 40.195, N° 6.182 y N° 6.276 de Declaraciones de Interés Educativo para los Programas Misión Antivirus o del Programa Misión Carácter y sus respectivos contenidos programáticos, y el instructivo del Concurso Nacional "Mi Experiencia JV".',
  },
  {
    texto:
      '**Artículo 4:** En el marco de este acuerdo específico, LA EDITORIAL se compromete a desarrollar los contenidos de los Programas Misión Antivirus y/o Misión Carácter, con grupos de aproximadamente 30 (treinta) estudiantes, de los grados y/o cursos detallados en el Formulario de Postulación de la Institución Educativa, que se anexa a este Acuerdo de Cooperación Específico. Los contenidos se entregarán mediante una (1) **intervención semanal** equivalente a una (1) **clase** con una duración de una (1) **hora cátedra** de 35 (mínimo) a 40 minutos (máximo), y LA EDITORIAL cubrirá los costos del/los **Facilitador/es** asignados a LA INSTITUCIÓN.',
  },
  {
    texto:
      '**Artículo 5:** LA EDITORIAL provee a cada estudiante, sin costo para el mismo ni para LA INSTITUCIÓN, un (1) **manual** del Programa Misión Antivirus o del Programa Misión Carácter que entregará por única vez a los estudiantes al inicio y será válido para todo el año académico.',
  },
  { texto: '**CLÁUSULA TERCERA - De las condiciones del acuerdo - Obligaciones de LA INSTITUCIÓN:**', titulo: true },
  {
    texto:
      '**Artículo 6:** En cuanto a los ~~días y horarios~~ de las **intervenciones**, LA EDITORIAL completará el Formulario de Postulación de la Institución Educativa con los datos previamente proporcionados por LA INSTITUCIÓN. relativos a la cantidad de estudiantes matriculados por grado/curso, la malla de horarios de clases y recesos, así como el nombre y contacto de los maestros/docentes que estarán en aula con el/la Facilitador/a. Dicho Formulario será remitido a LA INSTITUCIÓN a través del grupo (WhatsApp) de la Cooperación, para su correspondiente revisión y aprobación final, convirtiéndose este documento en un Anexo del presente Acuerdo. Los días y horarios de las intervenciones, se mantendrán lo más estable posible, y cualquier variación deberá ser informada al mencionado grupo y consensuada por ambas partes.',
  },
  {
    texto:
      '**Artículo 7:** En cuanto al ~~contenido, frecuencia, duración y participantes~~ de las **intervenciones**, LA INSTITUCIÓN declara conocer y aceptar que LA EDITORIAL desarrolla exclusivamente los contenidos del Programa Misión Antivirus y/o del Programa Misión Carácter y, a tal efecto, otorga a LA EDITORIAL 1 (una) hora cátedra semanal, con una duración mínima de 35 (treinta y cinco) minutos y máxima de 40 (cuarenta) minutos, dirigida aproximadamente 30 (treinta) estudiantes de los grados y/o cursos detallados en el Formulario de Postulación de LA INSTITUCIÓN. Asimismo, LA INSTITUCIÓN reconoce que, en caso de ausencia de más del 25% (veinticinco por ciento) de los estudiantes del grupo correspondiente, la intervención programada no se llevará a cabo.',
  },
  {
    texto:
      '**Artículo 8:** En cuanto a la ~~responsabilidad hacia los estudiantes~~ durante las **intervenciones,** LA INSTITUCIÓN reconoce que la responsabilidad disciplinaria, de supervisión y custodia de los estudiantes corresponde exclusivamente al maestro/docente nominado en el Formulario de Postulación de la Institución Educativa. En consecuencia, LA INSTITUCIÓN se compromete a garantizar la permanencia del referido maestro/docente desde el inicio hasta la finalización de cada intervención, a fin de velar por la asistencia, el orden y la disciplina del grupo, así como por el adecuado aprovechamiento de los contenidos desarrollados. En caso de ausencia eventual del maestro/docente responsable, LA INSTITUCIÓN se obliga a designar otro/a responsable que permanezca en aula durante toda la intervención, garantizando expresamente que el/la Facilitador/a asignado/a por LA EDITORIAL no asumirá funciones de custodia, supervisión ni responsabilidad disciplinaria del grupo. Asimismo, en **situaciones complejas** que los estudiantes pudieran manifestar al/a la Facilitador/a, ya sea en aula o durante el receso, y que involucren presuntos casos de abuso u otras circunstancias que requieran acción inmediata, LA EDITORIAL se compromete a acompañar al/a la estudiante ante las autoridades de LA INSTITUCIÓN para que este/a les informe directamente de la situación. La responsabilidad de activar los protocolos correspondientes y de dar continuidad al proceso recaerá exclusivamente en LA INSTITUCIÓN, quedando LA EDITORIAL liberada de cualquier obligación o responsabilidad adicional derivada de dichos hechos.',
  },
  {
    texto:
      '**Artículo 9:** En cuanto al ~~reporte~~ de las **intervenciones**, los/las Facilitadores/as contarán con 1 (una) Planilla de Reporte Diario del/de la Facilitador/a, en la cual registrarán cada intervención realizada conforme a lo establecido en el Formulario de Postulación. LA INSTITUCIÓN se compromete a verificar los datos consignados y a firmar dicha planilla de la siguiente manera: el/la **docente** presente en aula firmará al finalizar cada intervención; asimismo, la **Coordinación** y el/la **Director/a** firmarán y sellarán dicha planilla 1 (una) vez al mes. Al momento de la firma mensual, LA INSTITUCIÓN podrá realizar una fotocopia o tomar una fotografía de la planilla para su respaldo y eventual reporte ante el Ministerio de Educación y Ciencias (MEC). En cuanto a las evidencias (fotografías, registros u otros respaldos), cada INSTITUCIÓN será responsable de su autogestión a través de su propio plantel.',
  },
  {
    texto:
      '**Artículo 10:** En cuanto a los **manuales** para los alumnos, LA INSTITUCIÓN por medio de cada maestro/docente de grado/curso, se compromete a otorgar puntaje, como parte de su proceso evaluativo, a los estudiantes que cuenten con el correspondiente manual durante las intervenciones.',
  },
  {
    texto:
      '**Artículo 11:** En cuanto a la **encuesta** digital de retroalimentación de fin de año, LA INSTITUCIÓN autoriza a LA EDITORIAL a compartir en aula, con los estudiantes de 3er. Ciclo y Nivel Medio, un código QR; asimismo, autoriza a compartir con el plantel docente un enlace a través del grupo (WhatsApp) de la Cooperación, con el fin de que procedan a completar la referida encuesta.',
  },
  {
    texto:
      '**Artículo 12:** En cuanto al Concurso Nacional "**Mi Experiencia JV**", LA INSTITUCIÓN se compromete a instruir a su plantel docente de 6to grado, 3er. Ciclo y Nivel Medio, a fin de que consideren este proyecto dentro del proceso de evaluación del alumno y otorguen puntos a los participantes que presenten sus trabajos en tiempo y forma al Facilitador/a.',
  },
  {
    texto:
      '**Artículo 13:** LA INSTITUCIÓN se compromete a compartir con las autoridades competentes del Ministerio de Educación y Ciencias (MEC), los documentos mencionados en los artículos 3, 6 y 9, así como el presente Acuerdo.',
  },
  {
    texto:
      '**Artículo 14:** La firma del Formulario de Postulación y del presente Acuerdo constituye suficiente autorización de parte de LA INSTITUCIÓN hacia LA EDITORIAL para iniciar la Cooperación. LA INSTITUCIÓN garantiza el acceso del/los Facilitador/es de LA EDITORIAL a los grados y/o cursos detallados en dicho Formulario, en los días y horarios convenidos.',
  },
  { texto: '**CLÁUSULA CUARTA - De los responsables, de la duración del acuerdo y de la colaboración entre los firmantes.**', titulo: true },
  {
    texto:
      '**Artículo 15**: Cada una de las partes firmantes de este Acuerdo nombrará a un responsable encargado de coordinar todos los asuntos relacionados con el mismo. Por LA EDITORIAL este rol será asumido por la Sra. Cecilia Rafael, teléfono 0983-196085, y por LA INSTITUCIÓN, por el/la Director/a {director}, teléfono {telefono}. LA EDITORIAL habilita el grupo (WhatsApp) de la Cooperación para el envío de documentos, informaciones y avisos relacionados exclusivamente con el Proyecto Juventud con Valores.',
  },
  { texto: '**Artículo 16:** Este acuerdo será válido desde la fecha de la firma hasta el 30 de octubre del {anio}.' },
  {
    texto:
      '**Artículo 17:** Las partes suscribientes del presente documento colaborarán en todo momento, de acuerdo con los principios de buena fe y eficacia, para asegurar la correcta ejecución de lo pactado entre las instituciones sujetos del presente Acuerdo. Para que así conste, a los efectos oportunos y en prueba de conformidad, las partes firman el presente documento, en dos ejemplares y a un solo efecto, en la ciudad de ASUNCIÓN, marzo de {anio}.',
  },
];

/* ---- Los datos ---------------------------------------------------------------------------------- */

/** El director/a del período: la primera autoridad con "director" en el cargo. */
export function directorDe(autoridades: Autoridad[]): Autoridad | null {
  return autoridades.find((a) => /director/i.test(a.cargo) && a.nombre.trim()) ?? null;
}

/** Sin los signos que el texto usa para negrita y subrayado. */
const dato = (s: string) => s.replace(/[*~{}]/g, '').replace(/\s+/g, ' ').trim();

function completar(texto: string, d: Datos) {
  return texto.replace(/\{(\w+)\}/g, (_, k: keyof Datos) => d[k] ?? '');
}

/* ---- Párrafos justificados, con negrita y subrayado -------------------------------------------- */

type Estilo = { negrita: boolean; subrayado: boolean };
type Pieza = Estilo & { s: string; ancho: number };
/** Una palabra (sin espacios) hecha de una o más piezas con estilo. */
type Palabra = { piezas: Pieza[]; ancho: number };

const letra = (e: Partial<Estilo>, tam = TAM): Letra => ({ tam, negrita: e.negrita, serif: true, color: NEGRO });

/** "**negrita** y ~~subrayado~~" → tramos con su estilo. */
function tramos(texto: string): (Estilo & { s: string })[] {
  const out: (Estilo & { s: string })[] = [];
  const e: Estilo = { negrita: false, subrayado: false };
  for (const parte of texto.split(/(\*\*|~~)/)) {
    if (parte === '**') e.negrita = !e.negrita;
    else if (parte === '~~') e.subrayado = !e.subrayado;
    else if (parte) out.push({ ...e, s: parte });
  }
  return out;
}

function palabras(p: Pintor, texto: string, tam: number): Palabra[] {
  const out: Palabra[] = [];
  let actual: Pieza[] = [];
  const cerrar = () => {
    if (actual.length) out.push({ piezas: actual, ancho: actual.reduce((a, x) => a + x.ancho, 0) });
    actual = [];
  };
  for (const t of tramos(texto)) {
    t.s.split(/(\s+)/).forEach((trozo) => {
      if (!trozo) return;
      if (/^\s+$/.test(trozo)) return cerrar();
      actual.push({ ...t, s: trozo, ancho: p.ancho(trozo, letra(t, tam)) });
    });
  }
  cerrar();
  return out;
}

/** Corta las palabras en líneas de `ancho` como máximo. */
function lineas(ps: Palabra[], espacio: number, ancho: number): Palabra[][] {
  const out: Palabra[][] = [];
  let linea: Palabra[] = [];
  let usado = 0;
  for (const w of ps) {
    const con = linea.length ? usado + espacio + w.ancho : w.ancho;
    if (linea.length && con > ancho) {
      out.push(linea);
      linea = [w];
      usado = w.ancho;
    } else {
      linea.push(w);
      usado = con;
    }
  }
  if (linea.length) out.push(linea);
  return out;
}

/* ---- El dibujo ---------------------------------------------------------------------------------- */

type Imagenes = { logo: Logo | null; firma: Logo | null };

/**
 * Dibuja el acuerdo. `apilar`: las hojas una debajo de la otra (la vista previa); sin él, cada
 * hoja nueva es una página del PDF. Devuelve cuántas hojas ocupó.
 */
function dibujar(p: Pintor, d: Datos, img: Imagenes, apilar: boolean): number {
  let hoja = 0;
  let y = MARGEN.arriba;
  const base = () => (apilar ? hoja * (HOJA.alto + SEPARACION) : 0);
  const limite = HOJA.alto - MARGEN.abajo;

  const nuevaHoja = () => {
    hoja++;
    if (apilar) p.rect(-20, base() - SEPARACION, HOJA.ancho + 40, SEPARACION, '#d4d4d4', null);
    else p.nuevaPagina?.();
    y = MARGEN.arriba;
  };
  /** Si no entran `alto` puntos más en la hoja, pasa a la siguiente. */
  const lugar = (alto: number) => {
    if (y + alto > limite) nuevaHoja();
  };

  const espacio = p.ancho(' ', letra({}));

  const escribirLinea = (linea: Palabra[], x0: number, extra: number) => {
    let x = x0;
    const yc = base() + y + INTERLINEA / 2;
    // De `y` (centro) a la línea de base, como en la vista SVG; el subrayado va un poco más abajo.
    const ySub = yc + TAM * 0.34 + 1.1;
    linea.forEach((w, i) => {
      for (const pz of w.piezas) {
        p.texto(pz.s, x, yc, letra(pz));
        if (pz.subrayado) p.linea(x, ySub, x + pz.ancho, ySub, NEGRO, 0.5);
        x += pz.ancho;
      }
      const sig = linea[i + 1];
      const gap = espacio + extra;
      // El subrayado sigue por el espacio si la palabra siguiente también va subrayada.
      if (sig && w.piezas.at(-1)?.subrayado && sig.piezas[0]?.subrayado) p.linea(x, ySub, x + gap, ySub, NEGRO, 0.5);
      x += gap;
    });
  };

  const parrafo = (texto: string, opciones: { centrado?: boolean; juntoAlSiguiente?: boolean } = {}) => {
    const ls = lineas(palabras(p, texto, TAM), espacio, ANCHO_TEXTO);
    // Un título no queda solo al pie: con él tienen que entrar dos líneas del párrafo siguiente.
    lugar(opciones.juntoAlSiguiente ? INTERLINEA * (ls.length + 2) + ENTRE_PARRAFOS : INTERLINEA);
    ls.forEach((linea, i) => {
      lugar(INTERLINEA);
      const ancho = linea.reduce((a, w) => a + w.ancho, 0) + espacio * (linea.length - 1);
      const ultima = i === ls.length - 1;
      if (opciones.centrado) escribirLinea(linea, MARGEN.izq + (ANCHO_TEXTO - ancho) / 2, 0);
      else escribirLinea(linea, MARGEN.izq, ultima || linea.length < 2 ? 0 : (ANCHO_TEXTO - ancho) / (linea.length - 1));
      y += INTERLINEA;
    });
    y += ENTRE_PARRAFOS;
  };

  /* Logo y título */
  if (img.logo) {
    const alto = 52;
    const ancho = (alto * img.logo.ancho) / img.logo.alto;
    p.imagen(img.logo, (HOJA.ancho - ancho) / 2, base() + y - 18, ancho, alto);
    y += alto - 12;
  }
  y += 4;
  for (const t of ['ACUERDO ESPECÍFICO DE COOPERACIÓN', 'ENTRE LA EDITORIAL ETHOS']) {
    const w = p.ancho(t, letra({ negrita: true }));
    p.texto(t, (HOJA.ancho - w) / 2, base() + y + INTERLINEA / 2, letra({ negrita: true }));
    y += INTERLINEA;
  }
  parrafo(`**Y EL/LA ${d.institucion}**`, { centrado: true });
  y += 4;

  /* Las cláusulas */
  for (const par of PARRAFOS) parrafo(completar(par.texto, d), { juntoAlSiguiente: par.titulo });

  /* Las firmas: van juntas, en la misma hoja */
  const ALTO_FIRMAS = 96;
  lugar(ALTO_FIRMAS);
  y += 6;
  const arial = (tam: number, negrita = false): Letra => ({ tam, negrita, color: NEGRO });
  const centrar = (s: string, cx: number, yy: number, l: Letra) => p.texto(s, cx - p.ancho(s, l) / 2, base() + yy, l);

  const izq = MARGEN.izq + 85;
  const der = HOJA.ancho - MARGEN.der - 125;
  const yLinea = y + 62;

  // LA INSTITUCIÓN
  p.linea(izq - 62, base() + yLinea, izq + 62, base() + yLinea, NEGRO, 0.6);
  centrar('Firma Director IE', izq, yLinea + 12, letra({}, 9.5));
  if (d.director !== BLANCO_LARGO) centrar(d.director, izq, yLinea + 24, letra({}, 9));

  // LA EDITORIAL
  centrar('Editorial Ethos', der, y + 6, arial(9.5, true));
  if (img.firma) {
    const alto = 40;
    const ancho = (alto * img.firma.ancho) / img.firma.alto;
    p.imagen(img.firma, der - ancho / 2, base() + yLinea - alto - 2, ancho, alto);
  }
  p.linea(der - 62, base() + yLinea, der + 62, base() + yLinea, NEGRO, 0.6);
  centrar('P/Autorización Cecilia Rafael', der, yLinea + 12, arial(9.5));

  return hoja + 1;
}

/* ---- El documento ------------------------------------------------------------------------------- */

export type DatosAcuerdo = { institucion: Formulario; anio: string };

function datosDe({ institucion: f, anio }: DatosAcuerdo): Datos {
  const dir = directorDe(f.autoridades);
  return {
    institucion: dato(f.nombre).toUpperCase() || BLANCO_LARGO,
    director: dato(dir?.nombre ?? '') || BLANCO_LARGO,
    ci: dato(dir?.ci ?? '') || BLANCO_CORTO,
    telefono: dato(dir?.telefono ?? '') || BLANCO_LARGO,
    anio: dato(anio || f.anio),
  };
}

/** Lo que falta para completar el acuerdo, para avisarlo en la pantalla. */
export function faltantesAcuerdo(x: DatosAcuerdo): string[] {
  const dir = directorDe(x.institucion.autoridades);
  if (!dir) return [`La institución no tiene director/a cargado para ${x.anio}: el nombre, la cédula y el teléfono salen en blanco para completarlos a mano.`];
  const faltan = [!dir.ci.trim() && 'la cédula', !dir.telefono.trim() && 'el teléfono'].filter(Boolean);
  return faltan.length ? [`Falta ${faltan.join(' y ')} del director/a: sale en blanco para completarlo a mano.`] : [];
}

/** "Acuerdo - Colegio Nacional - 2026": el nombre del archivo y el título del PDF. */
export const nombreArchivoAcuerdo = (x: DatosAcuerdo) => ['Acuerdo de cooperación', limpio(x.institucion.nombre, 80), x.anio].filter(Boolean).join(' - ');

/** El acuerdo: el PDF en A4 vertical y, para la vista previa, las hojas una debajo de la otra. */
export function documentoAcuerdo(x: DatosAcuerdo, img: Imagenes): Documento {
  const archivo = nombreArchivoAcuerdo(x);
  const d = datosDe(x);
  return {
    archivo,
    lamina: () => {
      const p = new PintorSvg();
      const hojas = dibujar(p, d, img, true);
      return { ancho: HOJA.ancho, alto: hojas * HOJA.alto + (hojas - 1) * SEPARACION, trazos: p.trazos };
    },
    pdf: ({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setProperties({ title: archivo });
      doc.viewerPreferences({ DisplayDocTitle: true });
      // Las unidades del dibujo son puntos: 1 pt = 25,4 / 72 mm, sin margen extra (ya lo tiene el dibujo).
      dibujar(new PintorPdf(doc, 25.4 / 72, 0, 0), d, img, false);
      return doc;
    },
  };
}
