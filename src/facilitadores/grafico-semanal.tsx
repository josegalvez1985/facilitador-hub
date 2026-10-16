// Inicio: gráfico de intervenciones por semana del facilitador logueado.
// GET mis-intervenciones/por-dia (sql/intervenciones_app_ethos.sql → POR_DIA) trae una fila
// por día del año lectivo actual con total / Sí / No. Se pide una sola vez: los filtros de
// mes y semana se aplican acá, sin volver a consultar.
//
// Barras agrupadas por día (Total, Sí, No) con los colores de series del tema (colors.chart),
// leyenda con los totales de la semana, lectura del día tocado y vista de tabla: los valores
// siempre se pueden leer como texto, nunca solo por el color o la altura.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { authFetch } from './auth/api';
import { useSession } from './auth/session';
import { MESES, diaYMes, hoy, mismoDia, nombreMes, semanaDe, sumarDias } from './fechas';
import { useLayout } from './shell';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Card, Text } from './ui';

type Conteo = { total: number; si: number; no: number };
export type PorDia = { anio: number | null; dias: Record<string, Conteo> };

const pad = (n: number) => String(n).padStart(2, '0');
const claveDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lunesDe = (d: Date) => sumarDias(d, -((d.getDay() + 6) % 7));
const mesCorto = (m: number) => (MESES[m] ?? '').slice(0, 3);
const VACIO: Conteo = { total: 0, si: 0, no: 0 };

export async function cargarPorDia(): Promise<PorDia> {
  const r = (await authFetch('mis-intervenciones/por-dia')) as { data?: { anio?: unknown; dias?: unknown } };
  const d = r?.data ?? {};
  const dias: Record<string, Conteo> = {};
  for (const f of Array.isArray(d.dias) ? d.dias : []) {
    const x = f as Record<string, unknown>;
    const fecha = String(x.fecha ?? '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) dias[fecha] = { total: Number(x.total) || 0, si: Number(x.si) || 0, no: Number(x.no) || 0 };
  }
  return { anio: d.anio === null || d.anio === undefined ? null : Number(d.anio), dias };
}

/** Número de semana ISO 8601 (la semana empieza el lunes). */
export function semanaDelAnio(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const inicio = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - inicio) / 86_400_000 + 1) / 7);
}

/** "12–16 oct" o, si cruza de mes, "29 sep–3 oct" (de lunes a viernes). */
function rangoSemana(lunes: Date) {
  const viernes = sumarDias(lunes, 4);
  return lunes.getMonth() === viernes.getMonth()
    ? `${lunes.getDate()}–${viernes.getDate()} ${mesCorto(lunes.getMonth())}`
    : `${lunes.getDate()} ${mesCorto(lunes.getMonth())}–${viernes.getDate()} ${mesCorto(viernes.getMonth())}`;
}

/** Tope del eje y paso de las líneas guía en números redondos. */
function escala(max: number) {
  const paso = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : 20;
  const tope = Math.max(paso, Math.ceil(max / paso) * paso);
  return { tope, marcas: Array.from({ length: tope / paso + 1 }, (_, i) => i * paso) };
}

type Estado = { tipo: 'cargando' } | { tipo: 'sin-facilitador' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; datos: PorDia };

function usePorDia(): Estado {
  const { facilitador } = useSession();
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [r, setR] = useState<({ id: number } & Estado) | null>(null);
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarPorDia()
      .then((datos) => vigente && setR({ id, tipo: 'listo', datos }))
      .catch((e: unknown) => vigente && setR({ id, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No disponible' }));
    return () => {
      vigente = false;
    };
  }, [id]);
  if (facilitador.estado === 'listo' && facilitador.id === null) return { tipo: 'sin-facilitador' };
  if (facilitador.estado === 'error') return { tipo: 'error', mensaje: facilitador.mensaje };
  return r && r.id === id ? r : { tipo: 'cargando' };
}

export function GraficoSemanal() {
  const estado = usePorDia();
  const { colors } = useTheme();
  const s = useStyles();
  if (estado.tipo === 'sin-facilitador') return null;
  return (
    <Card style={s.tarjeta}>
      <Text weight="bold" size={16}>
        Intervenciones por semana
      </Text>
      {estado.tipo === 'listo' ? (
        <Contenido datos={estado.datos} />
      ) : (
        <View style={s.estado}>
          {estado.tipo === 'cargando' && <ActivityIndicator size="small" color={colors.mutedForeground} />}
          <Text size={12} color={estado.tipo === 'error' ? colors.destructive : colors.mutedForeground} accessibilityRole={estado.tipo === 'error' ? 'alert' : undefined}>
            {estado.tipo === 'error' ? `No se pudo cargar el gráfico. ${estado.mensaje}` : 'Cargando tus intervenciones…'}
          </Text>
        </View>
      )}
    </Card>
  );
}

function Contenido({ datos }: { datos: PorDia }) {
  const { colors } = useTheme();
  const s = useStyles();
  const { desktop } = useLayout();
  const ahora = hoy();
  const anio = datos.anio ?? ahora.getFullYear();

  // Meses del año lectivo, del actual hacia atrás hasta el primero con intervenciones.
  const mesHasta = anio === ahora.getFullYear() ? ahora.getMonth() : anio < ahora.getFullYear() ? 11 : 0;
  const primera = Object.keys(datos.dias).sort()[0];
  const mesDesde = Math.min(primera ? Number(primera.slice(5, 7)) - 1 : mesHasta, mesHasta);
  const meses = Array.from({ length: mesHasta - mesDesde + 1 }, (_, i) => mesHasta - i);

  const [mesElegido, setMes] = useState(mesHasta);
  const [semanaElegida, setSemana] = useState<string | null>(null);
  const [diaElegido, setDia] = useState<string | null>(null);
  const [tabla, setTabla] = useState(false);

  // Semanas (lunes) que tocan el mes elegido, sin pasar de la actual: de la más nueva a la más vieja.
  const semanas: Date[] = [];
  const finMes = new Date(anio, mesElegido + 1, 0);
  for (let l = lunesDe(new Date(anio, mesElegido, 1)); l <= finMes && l <= ahora; l = sumarDias(l, 7)) semanas.unshift(l);
  const actual = semanas.find((l) => claveDe(l) === semanaElegida) ?? semanas.find((l) => mismoDia(l, lunesDe(ahora))) ?? semanas[0] ?? lunesDe(ahora);

  // Lunes a viernes; sábado y domingo solo si hubo intervenciones.
  const dias = semanaDe(actual)
    .map((d) => ({ ...d, conteo: datos.dias[claveDe(d.fecha)] ?? VACIO }))
    .filter((d, i) => i < 5 || d.conteo.total > 0);
  const totales = dias.reduce((t, d) => ({ total: t.total + d.conteo.total, si: t.si + d.conteo.si, no: t.no + d.conteo.no }), VACIO);
  const { tope, marcas } = escala(Math.max(...dias.map((d) => d.conteo.total), 1));

  const conDatos = [...dias].reverse().find((d) => d.conteo.total > 0);
  const dia = dias.find((d) => claveDe(d.fecha) === diaElegido) ?? dias.find((d) => d.esHoy) ?? conDatos ?? dias[0]!;

  const ALTO = 140;
  const ancho = desktop ? 18 : 12;
  const series = [
    { clave: 'total' as const, etiqueta: 'Total', color: colors.chart.total },
    { clave: 'si' as const, etiqueta: 'Sí', color: colors.chart.si },
    { clave: 'no' as const, etiqueta: 'No', color: colors.chart.no },
  ];

  return (
    <>
      <Text size={12} color={colors.mutedForeground} style={{ marginTop: 2 }}>
        Año lectivo {anio} · Semana {semanaDelAnio(actual)} ({rangoSemana(actual)})
      </Text>

      {/* Filtros: mes y semana del año lectivo actual. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginTop: 12 }}>
        {meses.map((m) => (
          <Chip
            key={m}
            etiqueta={nombreMes(m)}
            activo={m === mesElegido}
            onPress={() => {
              setMes(m);
              setSemana(null);
              setDia(null);
            }}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginTop: 8 }}>
        {semanas.map((l) => (
          <Chip
            key={claveDe(l)}
            etiqueta={rangoSemana(l)}
            activo={mismoDia(l, actual)}
            onPress={() => {
              setSemana(claveDe(l));
              setDia(null);
            }}
          />
        ))}
      </ScrollView>

      {/* Leyenda con los totales de la semana. */}
      <View style={s.leyenda}>
        {series.map((se) => (
          <View key={se.clave} style={s.leyendaItem}>
            <View style={[s.muestra, { backgroundColor: se.color }]} />
            <Text size={12} color={colors.mutedForeground}>
              {se.etiqueta}
            </Text>
            <Text size={13} weight="bold">
              {totales[se.clave]}
            </Text>
          </View>
        ))}
        <Pressable onPress={() => setTabla(!tabla)} accessibilityRole="button" hitSlop={8} style={{ marginLeft: 'auto' }}>
          <Text size={12} weight="semibold" color={colors.primaryText}>
            {tabla ? 'Ver gráfico' : 'Ver tabla'}
          </Text>
        </Pressable>
      </View>

      {tabla ? (
        <View style={s.tabla} accessibilityLabel={`Tabla de intervenciones, semana ${semanaDelAnio(actual)}`}>
          <View style={[s.fila, s.filaTitulo]}>
            <Text size={11} weight="bold" color={colors.mutedForeground} style={s.colDia}>
              DÍA
            </Text>
            {series.map((se) => (
              <Text key={se.clave} size={11} weight="bold" color={colors.mutedForeground} style={s.colNum}>
                {se.etiqueta.toUpperCase()}
              </Text>
            ))}
          </View>
          {dias.map((d) => (
            <View key={d.clave} style={s.fila}>
              <Text size={13} weight={d.esHoy ? 'bold' : 'regular'} style={s.colDia}>
                {d.largo} {d.numero}
              </Text>
              {series.map((se) => (
                <Text key={se.clave} size={13} style={s.colNum}>
                  {d.conteo[se.clave]}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={s.grafico}>
            {/* Eje Y con números redondos. */}
            <View style={[s.ejeY, { height: ALTO }]}>
              {marcas.map((m) => (
                <Text key={m} size={10} color={colors.mutedForeground} style={[s.marca, { bottom: (m / tope) * ALTO - 7 }]}>
                  {m}
                </Text>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ height: ALTO }}>
                {marcas.map((m) => (
                  <View key={m} style={[s.guia, { bottom: (m / tope) * ALTO }]} />
                ))}
                <View style={s.grupos}>
                  {dias.map((d, i) => {
                    const elegido = d.clave === dia.clave;
                    return (
                      <Pressable
                        key={d.clave}
                        onPress={() => setDia(claveDe(d.fecha))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: elegido }}
                        accessibilityLabel={`${d.largo} ${d.numero}: ${d.conteo.total} intervenciones, ${d.conteo.si} desarrolladas Sí, ${d.conteo.no} No`}
                        style={[s.grupo, i > 0 && s.divisor, elegido && { backgroundColor: colors.muted }]}
                      >
                        {series.map((se) => {
                          const v = d.conteo[se.clave];
                          return v > 0 ? <View key={se.clave} style={[s.barra, { width: ancho, height: Math.max(2, Math.round((v / tope) * ALTO)), backgroundColor: se.color }]} /> : <View key={se.clave} style={{ width: ancho }} />;
                        })}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {/* Eje X: días. */}
              <View style={s.ejeX}>
                {dias.map((d, i) => (
                  <Text key={d.clave} size={10} weight={d.esHoy ? 'bold' : 'medium'} color={d.esHoy ? colors.foreground : colors.mutedForeground} style={[s.dia, i > 0 && s.divisor]}>
                    {d.corto} {d.numero}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          {/* Lectura del día tocado (o de hoy). */}
          <View style={s.lectura}>
            <Text size={12} weight="semibold">
              {diaYMes(dia.fecha)}
            </Text>
            {totales.total === 0 ? (
              <Text size={12} color={colors.mutedForeground}>
                Sin intervenciones en esta semana.
              </Text>
            ) : (
              <View style={s.lecturaValores}>
                {series.map((se) => (
                  <View key={se.clave} style={s.leyendaItem}>
                    <View style={[s.clave, { backgroundColor: se.color }]} />
                    <Text size={14} weight="bold">
                      {dia.conteo[se.clave]}
                    </Text>
                    <Text size={12} color={colors.mutedForeground}>
                      {se.etiqueta}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </>
  );
}

function Chip({ etiqueta, activo, onPress }: { etiqueta: string; activo: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: activo }} onPress={onPress} style={({ pressed }) => [s.chip, activo && s.chipActivo, pressed && { opacity: 0.8 }]}>
      <Text size={12} weight={activo ? 'bold' : 'medium'} color={activo ? colors.primaryForeground : colors.foreground}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    tarjeta: { marginBottom: 16 },
    estado: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
    chips: { flexDirection: 'row', gap: 6 },
    // Mismo redondeado que los botones de la app (Button: radius.md).
    chip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    leyenda: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 6, marginTop: 14, marginBottom: 12 },
    leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    muestra: { width: 10, height: 10, borderRadius: 2 },
    grafico: { flexDirection: 'row', gap: 6 },
    ejeY: { width: 22 },
    marca: { position: 'absolute', right: 0 },
    guia: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    grupos: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' },
    grupo: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, paddingHorizontal: 4, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
    // Línea fina entre días (del gráfico a la fila de días), del mismo gris que las guías.
    divisor: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border },
    barra: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    ejeX: { flexDirection: 'row' },
    dia: { flex: 1, textAlign: 'center', paddingTop: 6 },
    lectura: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 6 },
    lecturaValores: { flexDirection: 'row', gap: 16 },
    clave: { width: 10, height: 3, borderRadius: 2 },
    tabla: { borderTopWidth: 1, borderTopColor: c.border },
    fila: { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderBottomWidth: 1, borderBottomColor: c.border },
    filaTitulo: { minHeight: 30 },
    colDia: { flex: 1 },
    colNum: { width: 52, textAlign: 'right' },
  }),
);
