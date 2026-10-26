// "Formulario N° 2 - Reporte diario del facilitador", copiado de editorial-ethos-app
// (src/lib/reporte-diario-facilitador.ts y planilla-reporte-diario.ts, 26/10/2026) sin la salida a
// Excel: las clases del facilitador logueado en UNA institución con sus intervenciones de un
// período (normalmente un mes).
//
// LAS REGLAS (acordadas con Jose el 26/10/2026)
// - Una fila por postulación activa y por día con horario, en bloques por turno con su subtotal.
// - Las secciones se juntan: las postulaciones del mismo turno, día, hora, grado y manual que
//   solo cambian de sección son UNA clase con un renglón por sección.
// - Intervenciones de la 1° a la 4°: las de la clase en el período, en orden de fecha, una por
//   día (de varias el mismo día, la última). Si hay más de 4, salen las primeras 4 (`sobran`).
// - 1/0 = se desarrolló o no; si no, el motivo va en FIRMA PROF. / *JUSTIF. TOTAL = las desarrolladas.
// - En blanco, para completar a mano: recuperaciones y TÍTULO de las autoridades.
// - El año de las clases es el de la fecha desde.

import type { Autoridad, Detalle, Formulario, IntervencionForm } from './datos';
import { DIAS, GRADOS, MANUALES, limpio, nombreTurno, type ClaveDia, type ClaveGrado, type ClaveManual } from './listas';
import { documentoPlanilla, nuevaPlanilla, type Documento, type Estilo, type Parte } from './planilla';
import type { Logo } from './pintor';

/* ---- Tipos ----------------------------------------------------------------------------------- */

/** Una intervención de la clase, como sale en sus cuatro columnas. */
export type Intervencion2 = { fecha: string; indice: string; hecha: boolean; motivo: string };

/** Un renglón de la clase: una sección, con sus alumnos por grado y manual. */
export type Renglon = { idPostulacion: number; seccion: string; enfasis: string; grados: Record<ClaveGrado, number>; manuales: Record<ClaveManual, number> };

/** Una fila de la planilla: una clase (un día y una hora) con sus secciones. */
export type Clase = {
  turno: number | null;
  dia: ClaveDia;
  /** `HH:MM`. */
  hora: string;
  renglones: Renglon[];
  /** Las primeras cuatro del período, en orden de fecha. */
  intervenciones: Intervencion2[];
  /** Las que hubo en el período además de esas cuatro. */
  sobran: number;
};

export type Formulario2 = {
  anio: string;
  /** `YYYY-MM-DD`. */
  desde: string;
  hasta: string;
  /** La línea roja: "3ª ETAPA: 20 ABRIL - 13 MAYO". */
  etapa: string;
  institucion: Pick<Formulario, 'nombre' | 'direccion' | 'departamento' | 'ciudad' | 'barrio'>;
  autoridades: Autoridad[];
  facilitador: { nombre: string; telefono: string };
  clases: Clase[];
};

/** La coordinación nacional que imprime la cabecera (la misma del Form. 1). */
const COORDINACION = { nombre: 'Cecilia Rafael', telefono: '0983 196085' };

/* ---- Etapa ----------------------------------------------------------------------------------- */

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** "2026-04-20" → "20 ABRIL". */
const diaMes = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1] ?? ''}`;

/** La línea de la etapa: "ETAPA: 20 ABRIL - 13 MAYO", o "3ª ETAPA: …" si es una de la tabla. */
export function textoEtapa(desde: string, hasta: string, numero?: number | null): string {
  if (!desde || !hasta) return '';
  return `${numero ? `${numero}ª ` : ''}ETAPA: ${diaMes(desde)} - ${diaMes(hasta)}`;
}

/* ---- Armado ---------------------------------------------------------------------------------- */

/** "DD/MM/YYYY" → "YYYY-MM-DD". */
const aISO = (f: string | null) => {
  const m = f?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/** El día de la semana de un `YYYY-MM-DD` como clave de `DIAS` (sábado y domingo: null). */
const diaDeFecha = (f: string): ClaveDia | null => {
  const d = new Date(`${f}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return d >= 1 && d <= 5 ? DIAS[d - 1]!.clave : null;
};

const nroIndice = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

/** Las columnas con algo, como texto: la clave para juntar secciones. */
const usadas = (r: Record<string, number>) =>
  Object.entries(r)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(',');

/** Las clases (las postulaciones activas de la institución) con sus intervenciones del período. */
export function armarClases(postulaciones: Detalle[], intervenciones: IntervencionForm[], desde: string, hasta: string): Clase[] {
  // Una por día, la última (el id más alto), de cada postulación, en el período.
  const porPostulacion = new Map<number, Map<string, IntervencionForm>>();
  for (const i of intervenciones) {
    const f = aISO(i.fecha);
    if (!f || f < desde || f > hasta) continue;
    const dias = porPostulacion.get(i.idPostulacion) ?? new Map<string, IntervencionForm>();
    const antes = dias.get(f);
    if (!antes || antes.id < i.id) dias.set(f, i);
    porPostulacion.set(i.idPostulacion, dias);
  }

  type Armada = Omit<Clase, 'intervenciones' | 'sobran'> & { todas: Map<string, IntervencionForm> };
  const clases = new Map<string, Armada>();

  for (const p of postulaciones) {
    const dias = DIAS.filter((d) => p.dias[d.clave].desde);
    const propias = porPostulacion.get(p.id) ?? new Map<string, IntervencionForm>();
    for (const d of dias) {
      const hora = p.dias[d.clave].desde;
      const clave = [p.turno ?? '', d.clave, hora, usadas(p.grados), usadas(p.manuales)].join('|');
      const clase = clases.get(clave) ?? { turno: p.turno, dia: d.clave, hora, renglones: [], todas: new Map<string, IntervencionForm>() };
      clase.renglones.push({ idPostulacion: p.id, seccion: p.seccion, enfasis: p.enfasis, grados: p.grados, manuales: p.manuales });
      // Con varios días, cada intervención va a la fila de su día; la de un día que la
      // postulación no tiene, a la primera.
      for (const [f, i] of propias) {
        const suDia = diaDeFecha(f);
        const tieneSuDia = dias.some((x) => x.clave === suDia);
        if (dias.length > 1 && (tieneSuDia ? suDia !== d.clave : d !== dias[0])) continue;
        const antes = clase.todas.get(f);
        if (!antes || antes.id < i.id) clase.todas.set(f, i);
      }
      clases.set(clave, clase);
    }
  }

  const ordenDia = (c: ClaveDia) => DIAS.findIndex((d) => d.clave === c);
  return [...clases.values()]
    .map(({ todas, ...c }) => {
      const lista = [...todas.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, i]) => {
          const hecha = i.siNo.toUpperCase() === 'SI';
          return { fecha, indice: nroIndice(i.nroIndice), hecha, motivo: hecha ? '' : i.motivo };
        });
      return {
        ...c,
        renglones: c.renglones.sort((a, b) => a.seccion.localeCompare(b.seccion, 'es', { numeric: true })),
        intervenciones: lista.slice(0, 4),
        sobran: Math.max(0, lista.length - 4),
      };
    })
    .sort((a, b) => (a.turno ?? 99) - (b.turno ?? 99) || ordenDia(a.dia) - ordenDia(b.dia) || a.hora.localeCompare(b.hora));
}

/* ---- Cuentas --------------------------------------------------------------------------------- */

/** 4° a 6°, 7° a 9° y la Media; 2° y 3° grado solo si alguna clase los tiene. */
const gradosDe = (clases: Clase[]) => {
  const con2y3 = clases.some((c) => c.renglones.some((r) => r.grados.g2 || r.grados.g3));
  return GRADOS.filter((g) => con2y3 || (g.clave !== 'g2' && g.clave !== 'g3'));
};

const CICLOS: { titulo: string; claves: ClaveGrado[] }[] = [
  { titulo: '2º CICLO', claves: ['g2', 'g3', 'g4', 'g5', 'g6'] },
  { titulo: '3º CICLO', claves: ['g7', 'g8', 'g9'] },
  { titulo: 'N.MEDIO', claves: ['g1m', 'g2m', 'g3m'] },
];

const sumaGrado = (clases: Clase[], g: ClaveGrado) => clases.reduce((a, c) => a + c.renglones.reduce((b, r) => b + r.grados[g], 0), 0);
const sumaManual = (clases: Clase[], m: ClaveManual) => clases.reduce((a, c) => a + c.renglones.reduce((b, r) => b + r.manuales[m], 0), 0);
const totalAlumnos = (clases: Clase[]) => GRADOS.reduce((a, g) => a + sumaGrado(clases, g.clave), 0);
const totalManuales = (clases: Clase[]) => MANUALES.reduce((a, m) => a + sumaManual(clases, m.clave as ClaveManual), 0);

/** Las desarrolladas de una clase: su columna TOTAL. */
const hechas = (c: Clase) => c.intervenciones.filter((i) => i.hecha).length;

/** "Form. 2 - Escuela Básica N°129 - Nadia Rolón - 01-10-2026 al 31-10-2026". */
export function nombreArchivo2(f: Pick<Formulario2, 'institucion' | 'facilitador' | 'desde' | 'hasta'>) {
  const fecha = (x: string) => x.split('-').reverse().join('-');
  return ['Form. 2', limpio(f.institucion.nombre), limpio(f.facilitador.nombre), `${fecha(f.desde)} al ${fecha(f.hasta)}`].filter(Boolean).join(' - ');
}

/* ---- La planilla ----------------------------------------------------------------------------- */

const MISION =
  'Facilitamos que niños y jóvenes estudiantes descubran, internalicen y apliquen los principios y valores universales en su vida personal y en su comunidad (familia, colegio, barrio, etc.). Nuestro propósito es contribuir a la construcción de un PARAGUAY ÍNTEGRO regido por principios de elevada y comprobada moralidad, con el fin de erradicar la violencia, la pobreza y la corrupción, para construir una sociedad más justa, amable, próspera, de paz, y así elevar el CAPITAL SOCIAL de la Nación.';

const NOTA: Parte[] = [
  { t: '* CUANDO NO SE REALIZA LA INTERVENCIÓN PROGRAMADA, JUSTIFICAR ASÍ', subrayado: true },
  { t: ': "JORNADA SIND.", "LLUVIA", "FERIADO", "ASUETO", "ACTIVIDAD IE" (especifica en comentarios, cuál actividad), "PERSONAL" (justificar en el Whatsapp de JV y en Reporte Digital).' },
];

const C = { rojo: '#e00000', amarillo: '#ffff00', verde: '#92d050', naranja: '#ffc000', gris: '#d9d9d9', banda: '#f2f2f2' };

/** "2026-05-08" → "08/05". */
const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** TM, TT, TN: la etiqueta del subtotal del turno. */
const siglaTurno = (turno: number | null) => {
  const n = nombreTurno(turno);
  return n ? `T${n.charAt(0).toUpperCase()}` : 'S/T';
};

function armarPlanilla(x: Formulario2) {
  const grados = gradosDe(x.clases).map((g) => g.clave as string);
  const man = MANUALES.map((m) => m.clave as string);
  const ints = [1, 2, 3, 4];

  const columnas: [string, number][] = [
    ['n', 44],
    ...grados.map((k): [string, number] => [k, 30]),
    ['sec', 64],
    ...man.map((k): [string, number] => [k, 27]),
    ['dia', 40],
    ['hr', 46],
    ...ints.flatMap((k): [string, number][] => [
      [`i${k}_ind`, 40],
      [`i${k}_fec`, 62],
      [`i${k}_fir`, 86],
      [`i${k}_uno`, 24],
    ]),
    ['r_aut', 50],
    ['r_dia', 36],
    ['r_hr', 40],
    ['r_ind', 40],
    ['r_fec', 46],
    ['r_fir', 70],
    ['r_uno', 24],
    ['tot', 52],
  ];
  const { fila, poner, cuantas, terminar } = nuevaPlanilla(columnas);
  const g0 = grados[0]!;

  const rotulo: Estilo = { negrita: true, alinear: 'left' };
  const dato: Estilo = { alinear: 'left' };
  const cab: Estilo = { negrita: true, tam: 10, multilinea: true };

  /* ---- Título ---- */

  const r0 = fila(36);
  const r1 = fila(24);
  const logo = { f: r0, c: 0, nf: 2, nc: 2 };
  poner(r0, 'n', grados[1]!, '', {}, 2);
  poner(r0, grados[2]!, 'tot', [{ t: 'JUVENTUD CON VALORES - ' }, { t: `EDICIÓN ${x.anio}`, tinta: C.rojo, subrayado: true }], { negrita: true, tam: 21 });
  poner(r1, grados[2]!, 'tot', 'FORMULARIO N° 2 - REPORTE DIARIO DEL FACILITADOR', { negrita: true, tam: 15, fondo: C.amarillo });

  /* ---- Institución ---- */

  const r2 = fila(22);
  const r3 = fila(22);
  const ins = x.institucion;
  poner(r2, 'n', 'g6', 'DATOS INSTITUCIÓN:', { ...rotulo, multilinea: true }, 2);
  poner(r2, 'g7', 'g3m', 'NOMBRE:', rotulo);
  poner(r2, 'sec', 'i2_uno', ins.nombre, { ...dato, negrita: true });
  poner(r2, 'i3_ind', 'i3_fec', 'DPTO:', rotulo);
  poner(r2, 'i3_fir', 'i3_uno', ins.departamento, dato);
  poner(r2, 'i4_ind', 'i4_uno', 'FACILITADOR@:', rotulo);
  poner(r2, 'r_aut', 'r_fec', x.facilitador.nombre.toUpperCase());
  poner(r2, 'r_fir', 'tot', x.facilitador.telefono);
  poner(r3, 'g7', 'g3m', 'DIRECCIÓN:', rotulo);
  poner(r3, 'sec', 'hr', ins.direccion, dato);
  poner(r3, 'i1_ind', 'i1_fec', 'CIUDAD:', rotulo);
  poner(r3, 'i1_fir', 'i2_uno', ins.ciudad, dato);
  poner(r3, 'i3_ind', 'i3_fec', 'BARRIO:', rotulo);
  poner(r3, 'i3_fir', 'i3_uno', ins.barrio, dato);
  poner(r3, 'i4_ind', 'i4_uno', 'COORD. NACIONAL:', rotulo);
  poner(r3, 'r_aut', 'r_fec', COORDINACION.nombre);
  poner(r3, 'r_fir', 'tot', COORDINACION.telefono);

  /* ---- Autoridades y la misión ---- */

  // Cuatro renglones como mínimo, como la planilla: los que faltan van vacíos, para completar a mano.
  const autoridades = [...x.autoridades];
  while (autoridades.length < 4) autoridades.push({ cargo: '', nombre: '', ci: '', telefono: '' });
  const primera = cuantas();
  for (const a of autoridades) {
    const conCi = !!a.ci;
    const f = fila(20);
    if (conCi) fila(20);
    const n = conCi ? 2 : 1;
    poner(f, 'g7', 'g3m', 'CARGO:', rotulo, n);
    poner(f, 'sec', man[2]!, a.cargo, dato, n);
    poner(f, man[3]!, man[6]!, 'TÍTULO:', rotulo, n);
    // TÍTULO: la base no lo tiene.
    poner(f, 'dia', 'hr', '', dato, n);
    poner(f, 'i1_ind', 'i1_fec', 'NOMBRE:', rotulo, n);
    poner(f, 'i1_fir', 'i2_uno', a.nombre, dato, n);
    if (conCi) {
      poner(f, 'i3_ind', 'i3_fec', 'C.I. N°:', rotulo);
      poner(f, 'i3_fir', 'i3_uno', a.ci, dato);
    }
    poner(f + n - 1, 'i3_ind', 'i3_fec', 'TEL:', rotulo);
    poner(f + n - 1, 'i3_fir', 'i3_uno', a.telefono, dato);
  }
  const nAut = cuantas() - primera;
  poner(primera, 'n', 'g6', 'DATOS PRINCIPALES AUTORIDADES:', { ...rotulo, multilinea: true }, nAut);
  poner(primera, 'i4_ind', 'tot', MISION, { negrita: true, cursiva: true, multilinea: true, tam: 10.5 }, nAut);

  /* ---- La etapa ---- */

  const re = fila(24);
  const dosPuntos = x.etapa.indexOf(':');
  poner(
    re,
    'n',
    'tot',
    dosPuntos > 0
      ? [
          { t: x.etapa.slice(0, dosPuntos), tinta: C.rojo, subrayado: true },
          { t: x.etapa.slice(dosPuntos), tinta: C.rojo },
        ]
      : [{ t: x.etapa, tinta: C.rojo }],
    { negrita: true, tam: 15 },
  );

  /* ---- Encabezado de la tabla ---- */

  const h1 = fila(24);
  const h2 = fila(20);
  const h3 = fila(36);
  poner(h1, 'n', 'n', 'CANT. INT.', cab, 3);
  poner(h1, g0, 'g3m', 'CANT. ALUM. X GRADO/CURSO', cab);
  for (const ciclo of CICLOS) {
    const suyos = grados.filter((g) => (ciclo.claves as string[]).includes(g));
    if (suyos.length) poner(h2, suyos[0]!, suyos[suyos.length - 1]!, ciclo.titulo, cab);
  }
  for (const g of gradosDe(x.clases)) poner(h3, g.clave, g.clave, g.corto.replace('°M', 'º').replace('°', 'º'), cab);
  poner(h1, 'sec', 'sec', 'A/B, Enfasis/ Esp.', { ...cab, tam: 9.5 }, 3);
  poner(h1, man[0]!, man[6]!, 'CANT. ALUM. X MANUAL', cab);
  for (const m of MANUALES) poner(h2, m.clave, m.clave, m.corto, { ...cab, vertical: true, fondo: m.color, tinta: m.tinta }, 2);
  poner(h1, 'dia', 'hr', 'HORARIO ESTABLE', cab, 2);
  poner(h3, 'dia', 'dia', 'DIA', cab);
  poner(h3, 'hr', 'hr', 'HR', cab);
  for (const k of ints) {
    poner(h1, `i${k}_ind`, `i${k}_uno`, `${k}° INTERVENCION ETAPA`, { ...cab, tam: 11 }, 2);
    poner(h3, `i${k}_ind`, `i${k}_ind`, 'INDICE', { ...cab, tam: 9.5 });
    poner(h3, `i${k}_fec`, `i${k}_fec`, 'FECHA', cab);
    poner(h3, `i${k}_fir`, `i${k}_fir`, 'FIRMA PROF. / *JUSTIF.', { ...cab, tam: 9.5 });
    poner(h3, `i${k}_uno`, `i${k}_uno`, '1/0', { ...cab, tam: 9, fondo: C.verde });
  }
  poner(h1, 'r_aut', 'r_uno', 'REGISTRO DE RECUPERACIONES JUSTIFICADAS & AUTORIZADAS (máximo 1 x etapa)', { ...cab, fondo: C.naranja, tam: 10 }, 2);
  (
    [
      ['r_aut', 'AUT. POR:'],
      ['r_dia', 'DIA'],
      ['r_hr', 'HR'],
      ['r_ind', 'INDICE'],
      ['r_fec', 'FECHA'],
      ['r_fir', 'FIRMA PROF.'],
      ['r_uno', '1/0'],
    ] as const
  ).forEach(([k, s]) => poner(h3, k, k, s, { ...cab, tam: 9.5, fondo: C.naranja }));
  poner(h1, 'tot', 'tot', 'TOTAL', { ...cab, fondo: C.verde }, 3);

  /* ---- Detalle, por turno ---- */

  const num = (v: number) => (v ? String(v) : '');
  const turnos = [...new Set(x.clases.map((c) => c.turno))];
  for (const turno of turnos) {
    const clases = x.clases.filter((c) => c.turno === turno);
    clases.forEach((clase, i) => {
      const n = clase.renglones.length;
      const alto = n > 1 ? 22 : 28;
      const f0 = cuantas();
      for (const r of clase.renglones) {
        const f = fila(alto);
        for (const g of grados) poner(f, g, g, num(r.grados[g as ClaveGrado]));
        poner(f, 'sec', 'sec', [r.seccion, r.enfasis].filter(Boolean).join(' '));
        for (const m of man) poner(f, m, m, num(r.manuales[m as ClaveManual]));
      }
      poner(f0, 'n', 'n', String(i + 1), {}, n);
      const dia = DIAS.find((d) => d.clave === clase.dia);
      poner(f0, 'dia', 'dia', (dia?.corto ?? '').toUpperCase(), {}, n);
      poner(f0, 'hr', 'hr', clase.hora, {}, n);
      for (const k of ints) {
        const iv = clase.intervenciones[k - 1];
        poner(f0, `i${k}_ind`, `i${k}_ind`, iv?.indice ?? '', {}, n);
        poner(f0, `i${k}_fec`, `i${k}_fec`, iv ? ddmm(iv.fecha) : '', {}, n);
        poner(f0, `i${k}_fir`, `i${k}_fir`, iv?.motivo ?? '', { tam: 9, multilinea: true }, n);
        poner(f0, `i${k}_uno`, `i${k}_uno`, iv ? (iv.hecha ? '1' : '0') : '', { negrita: true, fondo: C.verde }, n);
      }
      for (const k of ['r_aut', 'r_dia', 'r_hr', 'r_ind', 'r_fec', 'r_fir', 'r_uno']) {
        poner(f0, k, k, '', k === 'r_aut' || k === 'r_uno' ? { fondo: C.naranja } : {}, n);
      }
      poner(f0, 'tot', 'tot', String(hechas(clase)), { negrita: true, fondo: C.verde }, n);
    });

    // El subtotal del turno: TM, TT, TN.
    const f = fila(22);
    poner(f, 'n', 'n', siglaTurno(turno), { negrita: true });
    for (const g of grados) poner(f, g, g, String(sumaGrado(clases, g as ClaveGrado)), { negrita: true });
    poner(f, 'sec', 'sec', '');
    for (const m of MANUALES) poner(f, m.clave, m.clave, String(sumaManual(clases, m.clave as ClaveManual)), { negrita: true, fondo: m.color, tinta: m.tinta });
    poner(f, 'dia', 'tot', '', { fondo: C.banda });
  }

  /* ---- Totales ---- */

  const rojo: Estilo = { negrita: true, tinta: C.rojo };
  const t1 = fila(22);
  poner(t1, 'n', 'n', '');
  for (const g of grados) poner(t1, g, g, String(sumaGrado(x.clases, g as ClaveGrado)), rojo);
  poner(t1, 'sec', 'sec', '');
  for (const m of MANUALES) poner(t1, m.clave, m.clave, String(sumaManual(x.clases, m.clave as ClaveManual)), { negrita: true, fondo: m.color, tinta: m.tinta });
  poner(t1, 'dia', 'tot', '', { fondo: C.banda });

  const t2 = fila(20);
  const t3 = fila(26);
  poner(t2, 'n', 'n', 'TOTAL:', { ...rojo, tam: 11 }, 2);
  for (const ciclo of CICLOS) {
    const suyos = grados.filter((g) => (ciclo.claves as string[]).includes(g));
    if (!suyos.length) continue;
    const suma = suyos.reduce((a, g) => a + sumaGrado(x.clases, g as ClaveGrado), 0);
    poner(t2, suyos[0]!, suyos[suyos.length - 1]!, String(suma), rojo);
  }
  poner(t3, g0, 'g3m', String(totalAlumnos(x.clases)), { ...rojo, tam: 15 });
  poner(t2, 'sec', 'sec', '', {}, 2);
  poner(t2, man[0]!, man[6]!, String(totalManuales(x.clases)), { ...rojo, tam: 15 }, 2);
  poner(t2, 'dia', 'hr', '', {}, 2);
  for (const k of ints) {
    poner(t2, `i${k}_ind`, `i${k}_fir`, '', {}, 2);
    const unos = x.clases.filter((c) => c.intervenciones[k - 1]?.hecha).length;
    poner(t2, `i${k}_uno`, `i${k}_uno`, String(unos), { negrita: true, fondo: C.verde }, 2);
  }
  poner(t2, 'r_aut', 'r_fir', '', {}, 2);
  poner(t2, 'r_uno', 'r_uno', '', { fondo: C.naranja }, 2);
  const total = x.clases.reduce((a, c) => a + hechas(c), 0);
  poner(t2, 'tot', 'tot', String(total), { negrita: true, fondo: C.verde }, 2);

  /* ---- Firmas, nota y comentarios ---- */

  const s1 = fila(64);
  const s2 = fila(17);
  const s3 = fila(17);
  poner(s1, 'n', 'tot', '', { soloDibujo: true }, 3);
  const firma = (desde: string, hasta: string, quien: string, que: string) => {
    poner(s1, desde, hasta, '', { sinBorde: true });
    poner(s2, desde, hasta, quien, { negrita: true, tam: 11, sinBorde: true });
    poner(s3, desde, hasta, que, { tam: 11, sinBorde: true });
  };
  firma('n', 'hr', 'FACILITADOR/A', 'FIRMA, ACLARACIÓN, FECHA, CI.');
  firma('i2_ind', 'i3_uno', 'COORDINADOR/A COLEGIO', 'FIRMA, ACLARACIÓN, FECHA, CI., SELLO');
  firma('r_aut', 'tot', 'DIRECTOR /A COLEGIO', 'FIRMA, ACLARACIÓN, FECHA, CI., SELLO');

  const rn = fila(22);
  poner(rn, 'n', 'tot', NOTA, { negrita: true, alinear: 'left', tam: 11 });
  const rc = fila(34);
  poner(rc, 'n', man[0]!, [{ t: 'COMENTARIOS GENERALES:', subrayado: true }], { negrita: true, alinear: 'left', fondo: C.gris });
  poner(rc, man[1]!, 'tot', '');

  return terminar(logo);
}

/** El Form. 2: oficio apaisado en una sola hoja, con el logo. */
export const documentoForm2 = (x: Formulario2, logo: Logo | null): Documento => documentoPlanilla(armarPlanilla(x), nombreArchivo2(x), logo);
