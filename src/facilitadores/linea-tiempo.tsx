// Vista "Línea de tiempo" de Mi agenda: el día como una columna de horas, con un
// bloque por clase (color del manual), separadores de turno y la hora actual.

import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { aMinutos, manualCompleto, type ClaseAgenda, type Horario } from './agenda';
import { COLOR_MANUAL } from './intervenciones';
import { alpha, radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Text } from './ui';

const ALTO_HORA = 90; // px por hora: una clase de 40 min entra con sus 3 líneas
const MARGEN = 48; // columna de horas
const ALTO_MIN = 56; // un bloque nunca es más bajo que esto (horario, manual e institución)

type Bloque = ClaseAgenda & { horario: Horario; ini: number; fin: number; col: number; cols: number };

/** Ubica bloques que se superponen en columnas, lado a lado. */
function columnas(clases: (ClaseAgenda & { horario: Horario })[]): Bloque[] {
  const items = clases
    .map((c) => {
      const ini = aMinutos(c.horario.desde);
      const fin = Math.max(c.horario.hasta ? aMinutos(c.horario.hasta) : ini + 40, ini + 10);
      return { ...c, ini, fin, col: 0, cols: 1 };
    })
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin);
  let grupo: Bloque[] = [];
  let finGrupo = -1;
  const cerrar = () => {
    const n = Math.max(1, ...grupo.map((b) => b.col + 1));
    grupo.forEach((b) => (b.cols = n));
    grupo = [];
  };
  for (const b of items) {
    if (b.ini >= finGrupo && grupo.length) cerrar();
    const ocupadas = new Set(grupo.filter((g) => g.fin > b.ini).map((g) => g.col));
    let col = 0;
    while (ocupadas.has(col)) col++;
    b.col = col;
    grupo.push(b);
    finGrupo = Math.max(finGrupo, b.fin);
  }
  if (grupo.length) cerrar();
  return items;
}

const ahoraEnMinutos = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function LineaDeTiempo({ clases, esHoy }: { clases: (ClaseAgenda & { horario: Horario })[]; esHoy: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [ancho, setAncho] = useState(0);
  const [ahora, setAhora] = useState(ahoraEnMinutos);

  // La línea de "ahora" se mueve sola cada minuto.
  useEffect(() => {
    if (!esHoy) return;
    const id = setInterval(() => setAhora(ahoraEnMinutos()), 60_000);
    return () => clearInterval(id);
  }, [esHoy]);

  const bloques = columnas(clases);
  if (!bloques.length) return null;
  const desde = Math.floor(Math.min(...bloques.map((b) => b.ini)) / 60);
  const hasta = Math.ceil(Math.max(...bloques.map((b) => b.fin)) / 60);
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const y = (min: number) => ((min - desde * 60) / 60) * ALTO_HORA;
  const alto = (hasta - desde) * ALTO_HORA;
  const util = Math.max(0, ancho - MARGEN - 4);

  // Separador al empezar cada turno (el primero de cada uno).
  const inicioTurno = new Map<string, number>();
  for (const b of bloques) {
    const t = b.turnoDescripcion || '';
    if (t && !inicioTurno.has(t)) inicioTurno.set(t, b.ini);
  }

  return (
    <View style={[s.contenedor, { height: alto + 16 }]} onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)} accessibilityLabel="Línea de tiempo del día">
      {horas.map((h) => (
        <View key={h} style={[s.hora, { top: y(h * 60) }]} pointerEvents="none">
          <Text size={10} color={colors.mutedForeground} style={s.horaTexto}>
            {String(h).padStart(2, '0')}:00
          </Text>
          <View style={s.linea} />
        </View>
      ))}

      {[...inicioTurno.entries()].map(([turno, min]) => (
        <View key={turno} style={[s.turno, { top: Math.max(0, y(min) - 18) }]} pointerEvents="none">
          <Text size={9} weight="bold" color={colors.mutedForeground} style={{ letterSpacing: 1 }}>
            {turno.toUpperCase()}
          </Text>
        </View>
      ))}

      {util > 0 &&
        bloques.map((b) => {
          const color = (b.manual && COLOR_MANUAL[b.manual]) || colors.primary;
          const w = util / b.cols;
          const h = Math.max(y(b.fin) - y(b.ini) - 3, ALTO_MIN);
          const completo = manualCompleto(b);
          return (
            <View
              key={b.idPostulacion}
              accessibilityLabel={`${b.horario.desde} a ${b.horario.hasta}, ${b.grado} grado, ${b.manual ?? ''}, ${b.institucion}`}
              style={[s.bloque, { top: y(b.ini) + 1, height: h, left: MARGEN + b.col * w, width: w - 4, borderLeftColor: color, backgroundColor: alpha(color, colors.scheme === 'dark' ? 0.22 : 0.12) }]}
            >
              <Text size={11} weight="bold" numberOfLines={1}>
                {b.horario.desde}–{b.horario.hasta} · {b.grado}
                {b.seccion ? ` ${b.seccion}` : ''}
              </Text>
              <Text size={10} color={colors.mutedForeground} numberOfLines={1}>
                {[b.manual, completo ? 'completado' : b.indiceSiguiente?.titulo].filter(Boolean).join(' · ')}
              </Text>
              <Text size={10} color={colors.mutedForeground} numberOfLines={1}>
                {b.institucion}
              </Text>
            </View>
          );
        })}

      {esHoy && ahora >= desde * 60 && ahora <= hasta * 60 && (
        <View style={[s.ahora, { top: y(ahora) }]} pointerEvents="none" accessibilityLabel="Hora actual">
          <View style={[s.ahoraPunto, { backgroundColor: colors.destructive }]} />
          <View style={[s.ahoraLinea, { backgroundColor: colors.destructive }]} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    contenedor: { position: 'relative', marginTop: 8, marginBottom: 16 },
    hora: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    horaTexto: { width: MARGEN - 6, marginTop: -6 },
    linea: { flex: 1, height: 1, backgroundColor: c.border },
    turno: { position: 'absolute', right: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: c.muted },
    bloque: { position: 'absolute', borderLeftWidth: 4, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', gap: 1 },
    ahora: { position: 'absolute', left: MARGEN - 6, right: 0, flexDirection: 'row', alignItems: 'center' },
    ahoraPunto: { width: 9, height: 9, borderRadius: 5 },
    ahoraLinea: { flex: 1, height: 2 },
  }),
);
