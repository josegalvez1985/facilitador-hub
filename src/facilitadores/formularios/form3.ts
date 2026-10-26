// "Formulario N° 3 - Mi agenda semanal del facilitador", copiado de editorial-ethos-app
// (src/lib/agenda-semanal-facilitador.ts y planilla-agenda-semanal.ts, 26/10/2026) sin la salida a
// Excel: la semana del facilitador logueado en un año lectivo, con sus postulaciones activas de
// todas sus instituciones y, en rojo, sus horarios bloqueados.
//
// LAS REGLAS (acordadas con Jose el 26/10/2026)
// - Solo MAÑANA y TARDE: el turno de la clase o, sin turno, por la hora (antes de las 12:00,
//   mañana). Las de la noche no salen: se avisa cuántas.
// - Las filas salen de las clases: las horas de inicio y de fin, en orden. Cada clase va en la
//   fila de su hora de inicio.
// - Una celda por institución, día y hora: lo que coincide se junta ("7° A+B", "8°&9°") y cuenta 1.
// - Rojo = horario bloqueado del facilitador ese año. Nombre IE completo.
// - "REUNIÓN DE FACILITADORES" y lo demás que no está en la base se completa a mano.

import type { DiasBloqueo, Postulacion } from './datos';
import { DIAS, GRADOS, limpio, minutos, type ClaveDia, type ClaveGrado } from './listas';
import { documentoPlanilla, nuevaPlanilla, type Documento, type Estilo } from './planilla';

/* ---- Tipos ----------------------------------------------------------------------------------- */

/** Una clase de la semana: una postulación en uno de sus días. */
type ClaseAgenda = { idInstitucion: number; institucion: string; turno: number | null; dia: ClaveDia; desde: string; hasta: string; grados: ClaveGrado[]; seccion: string };

type FilaAgenda = { hora: string; clases: Partial<Record<ClaveDia, { curso: string; institucion: string; cant: number }>>; bloqueado: Partial<Record<ClaveDia, boolean>> };

type TurnoAgenda = { titulo: 'MAÑANA' | 'TARDE'; sigla: 'TM' | 'TT'; filas: FilaAgenda[]; totales: Record<ClaveDia, number> };

export type Agenda = {
  anio: string;
  facilitador: string;
  turnos: TurnoAgenda[];
  total: number;
  /** Clases de la noche, que no salen. */
  noche: number;
  /** Postulaciones sin día ni hora, que no salen. */
  sinHorario: number;
  /** Lo de los bloqueos que no se pudo leer como franja: se avisa. */
  bloqueoIlegible: string[];
};

/* ---- Armado ---------------------------------------------------------------------------------- */

const min = (h: string) => minutos(h) ?? 0;

const RE_FRANJA = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
const dos = (n: string) => n.padStart(2, '0');

/** El texto de un día del bloqueo ("07:00 - 08:00, 13:30 - 15:00") → sus franjas; lo que no se entiende, aparte. */
function leerFranjas(texto: string) {
  const franjas: { desde: string; hasta: string }[] = [];
  const sobrante: string[] = [];
  for (const parte of texto.split(',')) {
    const p = parte.trim();
    if (!p) continue;
    const m = p.match(RE_FRANJA);
    if (m) franjas.push({ desde: `${dos(m[1]!)}:${m[2]!}`, hasta: `${dos(m[3]!)}:${m[4]!}` });
    else sobrante.push(p);
  }
  return { franjas, sobrante };
}

/** El grado como en la planilla: "4°", "1°M". */
const grado = (clave: string) => GRADOS.find((g) => g.clave === clave)?.corto ?? '';

/** "4°A", "7° A+B", "8°&9°", "7°,8°&9°": los grados (con sus secciones) de las clases de la celda. */
function textoCurso(cs: Pick<ClaseAgenda, 'grados' | 'seccion'>[]): string {
  const porGrado = new Map<string, Set<string>>();
  for (const c of cs) {
    for (const g of c.grados) {
      const secciones = porGrado.get(g) ?? new Set<string>();
      if (c.seccion.trim()) secciones.add(c.seccion.trim());
      porGrado.set(g, secciones);
    }
  }
  const partes = GRADOS.filter((g) => porGrado.has(g.clave)).map((g) => {
    const secciones = [...porGrado.get(g.clave)!].sort((a, b) => a.localeCompare(b, 'es'));
    if (!secciones.length) return grado(g.clave);
    // Una sección pegada ("4°A"); varias, con espacio y "+" ("7° A+B").
    return secciones.length === 1 ? `${grado(g.clave)}${secciones[0]}` : `${grado(g.clave)} ${secciones.join('+')}`;
  });
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(',')}&${partes[partes.length - 1]}`;
}

/** MAÑANA o TARDE de una clase; `null` = de la noche (no sale). */
function turnoDe(turno: number | null, hora: string): 0 | 1 | null {
  if (turno === 1) return 0;
  if (turno === 2) return 1;
  if (turno === 3) return null;
  return min(hora) < 12 * 60 ? 0 : 1;
}

/** La agenda del facilitador con sus postulaciones activas del año y su bloqueo, si tiene. */
export function armarAgenda(o: { anio: string; facilitador: string; postulaciones: Postulacion[]; bloqueo: DiasBloqueo | null }): Agenda {
  // Una clase por día con hora.
  const lista: ClaseAgenda[] = [];
  let sinHorario = 0;
  for (const p of o.postulaciones) {
    const dias = DIAS.filter((d) => p.dias[d.clave].desde);
    if (!dias.length) sinHorario += 1;
    for (const d of dias) {
      lista.push({
        idInstitucion: p.idInstitucion,
        institucion: p.institucion,
        turno: p.turno,
        dia: d.clave,
        desde: p.dias[d.clave].desde,
        hasta: p.dias[d.clave].hasta,
        grados: GRADOS.filter((g) => p.grados[g.clave]).map((g) => g.clave),
        seccion: p.seccion,
      });
    }
  }

  type Grupo = { turno: 0 | 1; dia: ClaveDia; hora: string; institucion: string; cs: ClaseAgenda[] };
  const grupos = new Map<string, Grupo>();
  const horas: [Set<string>, Set<string>] = [new Set(), new Set()];
  let noche = 0;

  for (const c of lista) {
    const t = turnoDe(c.turno, c.desde);
    if (t == null) {
      noche += 1;
      continue;
    }
    horas[t].add(c.desde);
    if (c.hasta) horas[t].add(c.hasta);
    const clave = [t, c.dia, c.desde, c.idInstitucion].join('|');
    const g = grupos.get(clave) ?? { turno: t, dia: c.dia, hora: c.desde, institucion: c.institucion, cs: [] };
    g.cs.push(c);
    grupos.set(clave, g);
  }

  // Las franjas bloqueadas de cada día.
  const bloqueoIlegible: string[] = [];
  const franjas = Object.fromEntries(
    DIAS.map((d) => {
      const { franjas, sobrante } = leerFranjas(o.bloqueo?.[d.clave] ?? '');
      bloqueoIlegible.push(...sobrante.map((s) => `${d.nombre}: ${s}`));
      return [d.clave, franjas];
    }),
  ) as Record<ClaveDia, { desde: string; hasta: string }[]>;

  const turnos = ([0, 1] as const).map((t): TurnoAgenda => {
    const delTurno = [...grupos.values()].filter((g) => g.turno === t);
    const filas = [...horas[t]]
      .sort((a, b) => min(a) - min(b))
      .map((hora): FilaAgenda => {
        const clases: FilaAgenda['clases'] = {};
        const bloqueado: FilaAgenda['bloqueado'] = {};
        for (const d of DIAS) {
          // De varias instituciones a la misma hora, la primera por nombre.
          const g = delTurno.filter((x) => x.dia === d.clave && x.hora === hora).sort((a, b) => a.institucion.localeCompare(b.institucion, 'es'))[0];
          if (g) clases[d.clave] = { curso: textoCurso(g.cs), institucion: g.institucion, cant: 1 };
          const h = min(hora);
          bloqueado[d.clave] = franjas[d.clave].some((f) => min(f.desde) <= h && (h < min(f.hasta) || (h === min(f.hasta) && !g)));
        }
        return { hora, clases, bloqueado };
      });
    const totales = Object.fromEntries(DIAS.map((d) => [d.clave, filas.reduce((a, f) => a + (f.clases[d.clave]?.cant ?? 0), 0)])) as Record<ClaveDia, number>;
    return { titulo: t === 0 ? 'MAÑANA' : 'TARDE', sigla: t === 0 ? 'TM' : 'TT', filas, totales };
  });

  const total = turnos.reduce((a, t) => a + DIAS.reduce((b, d) => b + t.totales[d.clave], 0), 0);
  return { anio: o.anio, facilitador: o.facilitador, turnos, total, noche, sinHorario, bloqueoIlegible };
}

/** "Form. 3 - Nadia Rolón - 2026". */
export const nombreArchivo3 = (a: Pick<Agenda, 'facilitador' | 'anio'>) => ['Form. 3', limpio(a.facilitador, 80), a.anio].filter(Boolean).join(' - ');

/* ---- La planilla ----------------------------------------------------------------------------- */

const C = { azul: '#1f3864', rojo: '#e00000', bloqueo: '#ff0000', amarillo: '#ffff00', gris: '#d9d9d9' };

/** "07:00" → "7:00", como la planilla. */
const hora = (h: string) => h.replace(/^0(\d:)/, '$1');

function armarPlanilla(a: Agenda) {
  const columnas: [string, number][] = [
    ['hora', 58],
    ...DIAS.flatMap((d): [string, number][] => [
      [`${d.clave}_c`, 60],
      [`${d.clave}_i`, 156],
      [`${d.clave}_n`, 40],
    ]),
  ];
  const { fila, poner, terminar } = nuevaPlanilla(columnas);
  const ultima = `${DIAS[DIAS.length - 1]!.clave}_n`;
  const cab: Estilo = { negrita: true, tam: 12.5, multilinea: true };
  const rojo: Estilo = { negrita: true, tinta: C.rojo };

  /* ---- Título ---- */

  poner(
    fila(24),
    'hora',
    ultima,
    [
      { t: 'JUVENTUD CON VALORES - ', tinta: C.azul },
      { t: `EDICIÓN ${a.anio}`, tinta: C.rojo, subrayado: true },
    ],
    { negrita: true, tam: 14 },
  );
  poner(fila(24), 'hora', ultima, 'FORMULARIO N° 3 - MI AGENDA SEMANAL DEL FACILITADOR', { negrita: true, tam: 14, tinta: C.azul, fondo: C.amarillo });
  const rn = fila(22);
  poner(rn, 'hora', 'lunes_n', 'NOMBRE:', { negrita: true, alinear: 'left', tam: 13 });
  poner(rn, 'martes_c', ultima, a.facilitador.toUpperCase(), { alinear: 'left', tam: 13 });

  /* ---- Encabezado ---- */

  const h1 = fila(24);
  const h2 = fila(36);
  poner(h1, 'hora', 'hora', 'HORARIO', cab, 2);
  for (const d of DIAS) {
    poner(h1, `${d.clave}_c`, `${d.clave}_n`, d.valor, { negrita: true, tam: 13 });
    poner(h2, `${d.clave}_c`, `${d.clave}_c`, 'Curso/ Grado', cab);
    poner(h2, `${d.clave}_i`, `${d.clave}_i`, 'Nombre IE', cab);
    poner(h2, `${d.clave}_n`, `${d.clave}_n`, 'Cant.', cab);
  }

  /* ---- Mañana y tarde ---- */

  const turno = (t: TurnoAgenda) => {
    poner(fila(20), 'hora', ultima, t.titulo, { ...rojo, tam: 13 });
    // Sin clases en el turno, un renglón vacío para completar a mano.
    const filas: FilaAgenda[] = t.filas.length ? t.filas : [{ hora: '', clases: {}, bloqueado: {} }];
    for (const f of filas) {
      const r = fila(20);
      poner(r, 'hora', 'hora', hora(f.hora), { alinear: 'left' });
      for (const d of DIAS) {
        const c = f.clases[d.clave];
        const fondo = f.bloqueado[d.clave] ? C.bloqueo : undefined;
        poner(r, `${d.clave}_c`, `${d.clave}_c`, c?.curso ?? '', { fondo });
        // El nombre completo: en dos renglones si no entra en uno.
        poner(r, `${d.clave}_i`, `${d.clave}_i`, c?.institucion ?? '', { fondo, multilinea: true });
        poner(r, `${d.clave}_n`, `${d.clave}_n`, c ? String(c.cant) : '', { ...rojo, fondo: C.gris });
      }
    }
    const r = fila(20);
    poner(r, 'hora', 'hora', t.sigla, { ...rojo, fondo: C.gris });
    for (const d of DIAS) {
      poner(r, `${d.clave}_c`, `${d.clave}_i`, '', { fondo: C.gris });
      poner(r, `${d.clave}_n`, `${d.clave}_n`, String(t.totales[d.clave]), { ...rojo, fondo: C.gris });
    }
  };
  for (const t of a.turnos) turno(t);

  const rt = fila(22);
  poner(rt, 'hora', 'hora', 'TOTAL', rojo);
  poner(rt, 'lunes_c', ultima, String(a.total), rojo);

  return terminar();
}

/** El Form. 3: oficio apaisado en una sola hoja. */
export const documentoForm3 = (a: Agenda): Documento => documentoPlanilla(armarPlanilla(a), nombreArchivo3(a), null);
