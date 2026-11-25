import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CalendarDays, ClipboardCheck, RefreshCw, ThumbsUp, TrendingUp, type LucideIcon } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { formatearFecha, listarEvaluaciones, TOTAL_ITEMS, type Evaluacion } from '../evaluaciones';
import { makeStyles, useTheme } from '../theme-provider';
import { Badge, Button, Card, PageTitle, StatIcon, Text, SinFacilitador } from '../ui';

// La página APEX pagina de a 15 filas.
const POR_PAGINA = 15;

type Estado = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; evaluaciones: Evaluacion[] };
type Resultado = { clave: string } & Exclude<Estado, { tipo: 'cargando' }>;

export function EvaluationsScreen() {
  const { colors } = useTheme();
  const { facilitador, reintentarFacilitador } = useSession();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const [visibles, setVisibles] = useState(POR_PAGINA);

  // Sin ID_FACILITADOR no se piden datos: nunca se listan evaluaciones "de todos".
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const clave = `${id}-${intento}`;
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    // El servidor saca el ID_FACILITADOR del token; acá solo se espera a que exista.
    listarEvaluaciones()
      .then((evaluaciones) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'listo', evaluaciones }))
      // "Sesión expirada" la resuelve el guardia (aviso + login). Sin red llega SinConexion con su mensaje.
      .catch((e: unknown) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudieron cargar las evaluaciones' }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  const estado: Estado = resultado && resultado.clave === clave ? resultado : { tipo: 'cargando' };
  const total = estado.tipo === 'listo' ? estado.evaluaciones.length : 0;
  const recargar = () => {
    setVisibles(POR_PAGINA);
    if (facilitador.estado === 'error') reintentarFacilitador();
    else setIntento((n) => n + 1);
  };

  const encabezado = (
    <PageTitle title="Evaluaciones" subtitle="Tus evaluaciones cerradas y su calificación.">
      <Button size="icon" variant="outline" icon={RefreshCw} accessibilityLabel="Actualizar evaluaciones" onPress={recargar} disabled={facilitador.estado === 'cargando' || (id !== null && estado.tipo === 'cargando')} />
    </PageTitle>
  );

  if (facilitador.estado === 'cargando') {
    return (
      <>
        {encabezado}
        <Cargando texto="Identificando al facilitador…" />
      </>
    );
  }
  if (facilitador.estado === 'error') {
    return (
      <>
        {encabezado}
        <ErrorCard mensaje={facilitador.mensaje} onReintentar={recargar} />
      </>
    );
  }
  if (id === null) {
    // NO_DATA_FOUND en FACILITADORES: el usuario no es facilitador, no hay nada propio que mostrar.
    return (
      <>
        {encabezado}
        <SinFacilitador />
      </>
    );
  }

  return (
    <>
      {encabezado}

      {estado.tipo === 'cargando' && <Cargando texto="Cargando evaluaciones…" />}

      {estado.tipo === 'error' && <ErrorCard mensaje={estado.mensaje} onReintentar={recargar} />}

      {estado.tipo === 'listo' && total === 0 && (
        <View style={{ paddingVertical: 56, alignItems: 'center', gap: 16 }}>
          <ClipboardCheck size={24} color={colors.mutedForeground} />
          <Text color={colors.mutedForeground}>No se ha encontrado ningún dato.</Text>
        </View>
      )}

      {estado.tipo === 'listo' &&
        estado.evaluaciones.slice(0, visibles).map((ev) => <EvaluacionCard key={ev.clave} ev={ev} />)}

      {estado.tipo === 'listo' && visibles < total && (
        <Button variant="outline" label={`Ver más (${total - visibles})`} onPress={() => setVisibles(visibles + POR_PAGINA)} style={{ alignSelf: 'center', marginTop: 4 }} />
      )}
    </>
  );
}

function Cargando({ texto }: { texto: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 56, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.primaryText} />
      <Text color={colors.mutedForeground}>{texto}</Text>
    </View>
  );
}

function ErrorCard({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
      <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
        {mensaje}
      </Text>
      <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={onReintentar} />
    </Card>
  );
}

function EvaluacionCard({ ev }: { ev: Evaluacion }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Card style={s.card}>
      <View style={s.top}>
        <View style={s.row}>
          <CalendarDays size={13} color={colors.foreground} />
          <Text weight="semibold" size={12}>
            {formatearFecha(ev.fechaDesde)}
          </Text>
        </View>
        {ev.calificacion ? <Badge tone="success" label={ev.calificacion} /> : null}
      </View>

      <View style={s.score}>
        <StatIcon icon={ClipboardCheck} tone="primary" size={40} />
        <View style={{ flex: 1 }}>
          <Text size={11} color={colors.mutedForeground}>
            Puntuación
          </Text>
          <Text weight="bold" size={22} accessibilityLabel={`Puntuación ${ev.puntuacion.replace('/', ' de ')}`}>
            {ev.puntuacion}
          </Text>
        </View>
      </View>
      <View style={s.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[s.barFill, { width: `${Math.min(100, (ev.marcadas / TOTAL_ITEMS) * 100)}%` }]} />
      </View>
      {ev.indicador ? (
        <Text size={12} color={colors.mutedForeground} style={{ marginTop: 10, lineHeight: 18 }}>
          {ev.indicador}
        </Text>
      ) : null}

      <Aspecto icon={ThumbsUp} tone="success" titulo="Aspectos positivos" texto={ev.aspectosPositivos} />
      <Aspecto icon={TrendingUp} tone="accent" titulo="Aspectos a mejorar" texto={ev.aspectosMejorar} />
    </Card>
  );
}

function Aspecto({ icon, tone, titulo, texto }: { icon: LucideIcon; tone: 'success' | 'accent'; titulo: string; texto: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.aspecto}>
      <View style={s.row}>
        <StatIcon icon={icon} tone={tone} size={26} />
        <Text weight="semibold" size={12}>
          {titulo}
        </Text>
      </View>
      <Text size={12} color={texto ? colors.foreground : colors.mutedForeground} style={{ marginTop: 8, lineHeight: 19 }}>
        {texto || 'Sin comentarios.'}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { marginBottom: 12 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    score: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bar: { height: 6, borderRadius: 3, backgroundColor: c.muted, marginTop: 12, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: c.primary },
    aspecto: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border },
  }),
);
