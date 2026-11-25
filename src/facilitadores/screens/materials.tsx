// "Mis materiales": los manuales de cada postulación del facilitador con todos sus
// índices, marcando desarrollados (✓, con fecha), pendientes (○) y el próximo
// (el siguiente al último desarrollado, como en Mi agenda). Datos: GET mis-materiales.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, Building2, Check, ChevronDown, ChevronUp, CircleCheck, Download, MapPin, RefreshCw, Share2 } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { diaMesAbreviado } from '../fechas';
import { COLOR_MANUAL } from '../intervenciones';
import { cargarMateriales, textoIndice, type ManualFacilitador } from '../materiales';
import { useLayout } from '../shell';
import { alpha, radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { Badge, Button, Card, PageTitle, Text, SinFacilitador } from '../ui';

type Filtro = 'todos' | 'curso' | 'completos';
type Resultado = { clave: string } & ({ tipo: 'error'; mensaje: string } | { tipo: 'listo'; manuales: ManualFacilitador[] });

// En web descarga un .txt; en iOS/Android abre la hoja de compartir del sistema.
async function exportar(m: ManualFacilitador) {
  const texto = textoIndice(m);
  const nombre = `${m.manual} ${m.grado}`.trim();
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombre}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: nombre, message: texto });
}

export function MaterialsScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const { desktop } = useLayout();
  const { facilitador, reintentarFacilitador } = useSession();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [manual, setManual] = useState<string | null>(null);

  // Sin ID_FACILITADOR no se piden datos (aislamiento entre facilitadores).
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const clave = `${id}-${intento}`;
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarMateriales()
      .then((r) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'listo', manuales: r.manuales }))
      .catch((e: unknown) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudieron cargar los materiales' }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);
  const r = resultado && resultado.clave === clave ? resultado : null;
  const recargar = () => (facilitador.estado === 'error' ? reintentarFacilitador() : setIntento((n) => n + 1));

  const encabezado = <PageTitle title="Mis materiales" subtitle="Tus manuales e índices, desarrollados y pendientes." />;

  if (facilitador.estado === 'listo' && facilitador.id === null) {
    return (
      <>
        {encabezado}
        <SinFacilitador />
      </>
    );
  }
  if (facilitador.estado === 'error' || r?.tipo === 'error') {
    const mensaje = facilitador.estado === 'error' ? facilitador.mensaje : r?.tipo === 'error' ? r.mensaje : '';
    return (
      <>
        {encabezado}
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
            {/not found/i.test(mensaje) ? 'Falta publicar en el backend el endpoint mis-materiales (sql/materiales_app_ethos.sql).' : mensaje}
          </Text>
          <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={recargar} />
        </Card>
      </>
    );
  }
  if (!r) {
    return (
      <>
        {encabezado}
        <View style={s.centro}>
          <ActivityIndicator color={colors.primaryText} />
          <Text color={colors.mutedForeground}>Cargando tus materiales…</Text>
        </View>
      </>
    );
  }

  const todos = r.manuales;
  if (!todos.length) {
    return (
      <>
        {encabezado}
        <Vacio texto="No tenés manuales asignados en el año lectivo actual." />
      </>
    );
  }

  const totalIndices = todos.reduce((n, m) => n + m.indices.length, 0);
  const hechos = todos.reduce((n, m) => n + m.desarrollados, 0);
  const completos = todos.filter((m) => m.completo).length;
  const manualesPresentes = [...new Set(todos.map((m) => m.manual))];
  const visibles = todos.filter(
    (m) => (filtro === 'todos' || (filtro === 'completos' ? m.completo : !m.completo)) && (manual === null || m.manual === manual),
  );

  return (
    <>
      {encabezado}

      <Card style={{ marginBottom: 16 }}>
        <View style={s.resumen}>
          <Dato valor={hechos} etiqueta="Índices desarrollados" color={colors.success} />
          <Dato valor={totalIndices - hechos} etiqueta="Pendientes" color={colors.accent} />
          <Dato valor={completos} etiqueta={completos === 1 ? 'Manual completo' : 'Manuales completos'} color={colors.primaryText} />
        </View>
        <View style={s.barra}>
          <View style={[s.barraFill, { width: `${totalIndices ? (hechos / totalIndices) * 100 : 0}%`, backgroundColor: colors.success }]} />
        </View>
        <Text size={11} color={colors.mutedForeground} style={{ marginTop: 6 }}>
          {totalIndices ? Math.round((hechos / totalIndices) * 100) : 0}% de avance en {todos.length} {todos.length === 1 ? 'manual' : 'manuales'}
        </Text>
      </Card>

      <View style={s.segmento} accessibilityRole="tablist">
        {(
          [
            ['todos', 'Todos'],
            ['curso', 'En curso'],
            ['completos', 'Completos'],
          ] as const
        ).map(([v, l]) => (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: filtro === v }} onPress={() => setFiltro(v)} style={[s.segmentoOp, filtro === v && s.segmentoActivo]}>
            <Text size={13} weight={filtro === v ? 'bold' : 'medium'} color={filtro === v ? colors.primaryText : colors.mutedForeground}>
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      {manualesPresentes.length > 1 && (
        <View style={s.chips}>
          <Chip etiqueta="Todos los manuales" activo={manual === null} onPress={() => setManual(null)} />
          {manualesPresentes.map((m) => (
            <Chip key={m} etiqueta={m} color={COLOR_MANUAL[m]} activo={manual === m} onPress={() => setManual(manual === m ? null : m)} />
          ))}
        </View>
      )}

      {!visibles.length ? (
        <Vacio texto={filtro === 'completos' ? 'Todavía no completaste ningún manual.' : 'No hay manuales con este filtro.'} />
      ) : (
        <View style={[s.grid, desktop && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {visibles.map((m) => (
            <View key={m.idPostulacion} style={desktop ? { width: '48.5%' } : null}>
              <ManualCard m={m} />
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function ManualCard({ m }: { m: ManualFacilitador }) {
  const { colors } = useTheme();
  const s = useStyles();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const color = COLOR_MANUAL[m.manual] ?? colors.primary;
  const avance = m.indices.length ? m.desarrollados / m.indices.length : 0;
  return (
    <Card style={[s.manualCard, { borderTopColor: color }]}>
      <View style={s.manualHead}>
        <View style={[s.manualBadge, { backgroundColor: alpha(color, colors.scheme === 'dark' ? 0.25 : 0.14) }]}>
          <BookOpen size={14} color={color} />
          <Text weight="extrabold" size={13} color={colors.foreground}>
            {m.manual}
          </Text>
        </View>
        {m.completo ? <Badge tone="success" icon={CircleCheck} label="Completado" /> : <Badge label="En curso" />}
      </View>

      <Text weight="bold" size={15} style={{ marginTop: 12 }}>
        {m.grado ? `${m.grado} grado` : 'Clase'}
        {m.seccion ? ` · Sección ${m.seccion}` : ''}
        {m.turno ? ` · ${m.turno}` : ''}
      </Text>
      <View style={[s.fila, { marginTop: 4 }]}>
        <Building2 size={13} color={colors.mutedForeground} />
        <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>
          {m.institucion}
        </Text>
      </View>

      <View style={[s.fila, { marginTop: 14 }]}>
        <View style={[s.barra, { flex: 1, marginTop: 0 }]}>
          <View style={[s.barraFill, { width: `${avance * 100}%`, backgroundColor: m.completo ? colors.success : color }]} />
        </View>
        <Text size={12} weight="bold">
          {m.desarrollados} de {m.indices.length}
        </Text>
      </View>

      {m.siguiente && (
        <View style={s.proximo}>
          <Text size={11} color={colors.mutedForeground}>
            Próximo índice
          </Text>
          <Text weight="semibold" size={13} style={{ marginTop: 2 }}>
            {m.siguiente.titulo}
          </Text>
        </View>
      )}

      <View style={[s.fila, { marginTop: 12, justifyContent: 'space-between' }]}>
        <Button variant="ghost" size="sm" icon={abierto ? ChevronUp : ChevronDown} label={abierto ? 'Ocultar índices' : 'Ver índices'} onPress={() => setAbierto(!abierto)} />
        <Button
          variant="ghost"
          size="sm"
          icon={Platform.OS === 'web' ? Download : Share2}
          label={Platform.OS === 'web' ? 'Descargar' : 'Compartir'}
          accessibilityLabel={`${Platform.OS === 'web' ? 'Descargar' : 'Compartir'} índice de ${m.manual} ${m.grado}`}
          onPress={() => void exportar(m)}
        />
      </View>

      {abierto && (
        <View style={s.lista} accessibilityLabel={`Índices de ${m.manual}`}>
          {m.indices.map((i) => {
            const esProximo = m.siguiente?.id === i.id;
            return (
              <View key={i.id} style={[s.item, esProximo && { backgroundColor: alpha(color, colors.scheme === 'dark' ? 0.2 : 0.1) }]}>
                <View style={[s.marca, i.desarrollado ? { backgroundColor: colors.success, borderColor: colors.success } : { borderColor: esProximo ? color : colors.border }]}>
                  {i.desarrollado && <Check size={12} color={colors.primaryForeground} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={13} weight={esProximo ? 'bold' : 'regular'} color={i.desarrollado ? colors.foreground : esProximo ? colors.foreground : colors.mutedForeground}>
                    {i.titulo}
                  </Text>
                  <Text size={10} color={i.desarrollado ? colors.success : colors.mutedForeground} style={{ marginTop: 2 }}>
                    {i.desarrollado ? `Desarrollado${i.fecha ? ` · ${diaMesAbreviado(i.fecha)}` : ''}` : esProximo ? 'Próximo' : 'Pendiente'}
                  </Text>
                </View>
                {esProximo && <Button size="sm" icon={MapPin} label="Marcar" onPress={() => router.navigate('/marcar')} />}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function Dato({ valor, etiqueta, color }: { valor: number; etiqueta: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text weight="bold" size={24} color={color}>
        {valor}
      </Text>
      <Text size={11} color={colors.mutedForeground}>
        {etiqueta}
      </Text>
    </View>
  );
}

function Chip({ etiqueta, activo, color, onPress }: { etiqueta: string; activo: boolean; color?: string; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Filtrar ${etiqueta}`} accessibilityState={{ selected: activo }} onPress={onPress} style={[s.chip, color ? { borderColor: color } : null, activo && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {color && <View style={[s.punto, { backgroundColor: color }]} />}
      <Text size={12} weight={activo ? 'bold' : 'medium'} color={activo ? colors.primaryForeground : colors.foreground}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

function Vacio({ texto }: { texto: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.centro}>
      <BookOpen size={24} color={colors.mutedForeground} />
      <Text color={colors.mutedForeground} style={{ textAlign: 'center' }}>
        {texto}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    centro: { paddingVertical: 56, alignItems: 'center', gap: 12 },
    resumen: { flexDirection: 'row', gap: 12 },
    barra: { height: 6, borderRadius: 3, backgroundColor: c.muted, marginTop: 14, overflow: 'hidden' },
    barraFill: { height: 6, borderRadius: 3 },
    segmento: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: c.muted, borderRadius: radius.lg, marginBottom: 12 },
    segmentoOp: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: radius.md },
    segmentoActivo: { backgroundColor: c.card, ...c.shadow },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    punto: { width: 8, height: 8, borderRadius: 4 },
    grid: { gap: 12, justifyContent: 'space-between' },
    manualCard: { borderTopWidth: 4, marginBottom: 0 },
    manualHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    manualBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    proximo: { marginTop: 12, padding: 10, borderRadius: radius.md, backgroundColor: c.muted },
    lista: { marginTop: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 2 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius.md },
    marca: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  }),
);
