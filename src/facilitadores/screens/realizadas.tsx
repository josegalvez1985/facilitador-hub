// "Intervenciones realizadas" = páginas 4, 5 y 6 de APEX 193573, en una sola pantalla:
// - Página 4 "Intervenciones": tus instituciones del año lectivo.
// - Página 5 "Días": las clases que marcaste en la institución, con los días (L a V).
// - Página 6 "Manuales": el historial de la clase (fecha, manual, índice, observación, Sí/No).
// En celular se recorre por pasos con una miga de pan; en escritorio, las instituciones
// quedan a la izquierda (la primera seleccionada, como el IG de la página 4) y el detalle a la derecha.

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Building2, Check, ChevronRight, History, Pencil, RefreshCw, Search, X } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { EditarIntervencion } from '../editar-intervencion';
import { diaYMes, nombreMes } from '../fechas';
import { COLOR_MANUAL } from '../intervenciones';
import {
  cargarClases,
  cargarHistorial,
  cargarInstituciones,
  DIAS_HABILES,
  nombreClase,
  porcentaje,
  type ClaseRealizada,
  type InstitucionRealizada,
  type IntervencionRealizada,
} from '../realizadas';
import { useLayout } from '../shell';
import { alpha, radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { Badge, Button, Card, Field, PageTitle, SectionHeading, Text } from '../ui';

const POR_PAGINA = 15; // como el reporte de la página 6
const FALTA_PUBLICAR = 'Falta publicar en el backend los endpoints de intervenciones-realizadas (sql/intervenciones_realizadas_app_ethos.sql).';

type Carga<T> = { clave: string; ok: true; datos: T } | { clave: string; ok: false; mensaje: string };

/** Pide datos cuando cambia `clave` (null = no pedir nada) y descarta respuestas viejas.
 * `recargar` vuelve a pedir manteniendo a la vista los datos anteriores hasta que llegan los nuevos. */
function useCarga<T>(clave: string | null, cargar: () => Promise<T>) {
  const [res, setRes] = useState<Carga<T> | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (clave === null) return;
    let vigente = true;
    cargar()
      .then((datos) => vigente && setRes({ clave, ok: true, datos }))
      .catch((e: unknown) => vigente && setRes({ clave, ok: false, mensaje: e instanceof Error ? e.message : 'No se pudieron cargar los datos' }));
    return () => {
      vigente = false;
    };
    // `cargar` cambia en cada render; lo que decide pedir de nuevo es la clave (o recargar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);
  return { actual: res && res.clave === clave ? res : null, recargar: () => setIntento((n) => n + 1) };
}

export function RealizadasScreen() {
  const s = useStyles();
  const { desktop, wide } = useLayout();
  const { facilitador, reintentarFacilitador } = useSession();
  const [instSel, setInstSel] = useState<number | null>(null);
  const [claseSel, setClaseSel] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [editar, setEditar] = useState<number | null>(null);

  // Sin ID_FACILITADOR no se piden datos (aislamiento entre facilitadores).
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const inst = useCarga(id === null ? null : `${id}`, cargarInstituciones);
  const lista = inst.actual?.ok ? inst.actual.datos.instituciones : [];

  // En escritorio queda seleccionada la primera (p_select_first_row de la página 4);
  // en celular, solo si hay una sola institución.
  const instActiva = lista.find((i) => i.id === instSel) ?? (desktop || lista.length === 1 ? lista[0] : undefined);
  const clases = useCarga(id === null || !instActiva ? null : `${id}-${instActiva.id}`, () => cargarClases(instActiva!.id));
  const claseActiva = clases.actual?.ok ? clases.actual.datos.find((c) => c.clave === claseSel) : undefined;
  const hist = useCarga(id === null || !instActiva || !claseActiva ? null : `${id}-${instActiva.id}-${claseActiva.clave}`, () => cargarHistorial(instActiva!.id, claseActiva!));

  const elegirInstitucion = (i: number | null) => {
    setInstSel(i);
    setClaseSel(null);
  };

  const encabezado = <PageTitle title="Intervenciones realizadas" subtitle="Lo que marcaste este año lectivo, por institución y por clase." />;

  if (facilitador.estado === 'listo' && facilitador.id === null) {
    return (
      <>
        {encabezado}
        <Vacio texto="Tu usuario no está registrado como facilitador." />
      </>
    );
  }
  if (facilitador.estado === 'error' || inst.actual?.ok === false) {
    const mensaje = facilitador.estado === 'error' ? facilitador.mensaje : inst.actual?.ok === false ? inst.actual.mensaje : '';
    return (
      <>
        {encabezado}
        <ErrorCarga mensaje={mensaje} onReintentar={() => (facilitador.estado === 'error' ? reintentarFacilitador() : inst.recargar())} />
      </>
    );
  }
  if (!inst.actual) {
    return (
      <>
        {encabezado}
        <Cargando texto="Cargando tus instituciones…" />
      </>
    );
  }
  if (!lista.length) {
    return (
      <>
        {encabezado}
        <Vacio texto="No tenés instituciones en el año lectivo actual." />
      </>
    );
  }

  const filtro = busqueda.trim().toLowerCase();
  const visibles = filtro ? lista.filter((i) => i.nombre.toLowerCase().includes(filtro)) : lista;
  const panelInstituciones = (
    <View style={{ gap: 10 }}>
      {lista.length > 5 && <Field label="Buscar institución" icon={Search} value={busqueda} onChangeText={setBusqueda} placeholder="Nombre de la institución" autoCorrect={false} />}
      {visibles.map((i) => (
        <InstitucionItem key={i.id} i={i} activa={desktop && instActiva?.id === i.id} onPress={() => elegirInstitucion(i.id)} />
      ))}
      {!visibles.length && <Vacio texto="Ninguna institución coincide con la búsqueda." />}
    </View>
  );

  // Miga de pan del detalle. En celular, "Instituciones" vuelve a la lista (si hay más de una).
  const migas: { etiqueta: string; onPress?: () => void }[] = [];
  if (!desktop && lista.length > 1) migas.push({ etiqueta: 'Instituciones', onPress: () => elegirInstitucion(null) });
  if (instActiva) migas.push({ etiqueta: instActiva.nombre, onPress: claseActiva ? () => setClaseSel(null) : undefined });
  if (claseActiva) migas.push({ etiqueta: `${nombreClase(claseActiva)} · ${claseActiva.turnoDescripcion}` });

  let detalle: ReactNode = null;
  if (instActiva) {
    detalle = (
      <>
        <Migas items={migas} />
        {claseActiva ? (
          hist.actual?.ok === false ? (
            <ErrorCarga mensaje={hist.actual.mensaje} onReintentar={hist.recargar} />
          ) : !hist.actual ? (
            <Cargando texto="Cargando el historial…" />
          ) : (
            <Historial key={claseActiva.clave} clase={claseActiva} institucion={instActiva.nombre} filas={hist.actual.datos} onEditar={setEditar} />
          )
        ) : clases.actual?.ok === false ? (
          <ErrorCarga mensaje={clases.actual.mensaje} onReintentar={clases.recargar} />
        ) : !clases.actual ? (
          <Cargando texto="Cargando tus clases…" />
        ) : (
          <Clases institucion={instActiva} clases={clases.actual.datos} onElegir={(c) => setClaseSel(c.clave)} />
        )}
      </>
    );
  }

  // Página 8: al guardar se refresca el historial de la clase.
  const edicion = <EditarIntervencion id={editar} onClose={() => setEditar(null)} onGuardada={hist.recargar} />;

  if (desktop) {
    return (
      <>
        {encabezado}
        <View style={s.columnas}>
          <View style={{ width: wide ? 320 : 250 }}>{panelInstituciones}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{detalle}</View>
        </View>
        {edicion}
      </>
    );
  }
  return (
    <>
      {encabezado}
      {instActiva ? detalle : panelInstituciones}
      {edicion}
    </>
  );
}

/* --------------------------------- Página 4 -------------------------------- */

function InstitucionItem({ i, activa, onPress }: { i: InstitucionRealizada; activa: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const p = porcentaje(i.desarrolladas, i.marcaciones);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${i.nombre}, ${i.marcaciones} marcaciones`}
      accessibilityState={{ selected: activa }}
      onPress={onPress}
      style={({ pressed }) => [s.item, activa && { borderColor: colors.primary, backgroundColor: colors.secondary }, pressed && { opacity: 0.85 }]}
    >
      <View style={s.fila}>
        <Building2 size={16} color={activa ? colors.primaryText : colors.mutedForeground} />
        <Text weight="bold" size={14} style={{ flex: 1 }}>
          {i.nombre}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </View>
      <Contadores marcaciones={i.marcaciones} desarrolladas={i.desarrolladas} />
      <Barra valor={p} />
    </Pressable>
  );
}

/* --------------------------------- Página 5 -------------------------------- */

function Clases({ institucion, clases, onElegir }: { institucion: InstitucionRealizada; clases: ClaseRealizada[]; onElegir: (c: ClaseRealizada) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const { wide } = useLayout();
  return (
    <>
      <SectionHeading title="Tus clases">
        <Text size={12} color={colors.mutedForeground}>
          {clases.length} {clases.length === 1 ? 'clase' : 'clases'}
        </Text>
      </SectionHeading>
      {!clases.length ? (
        <Vacio texto={`Todavía no marcaste intervenciones en ${institucion.nombre} este año lectivo.`} />
      ) : (
        <View style={[s.grid, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {clases.map((c) => (
            <View key={c.clave} style={wide ? { width: '48.8%' } : null}>
              <ClaseCard c={c} onPress={() => onElegir(c)} />
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function ClaseCard({ c, onPress }: { c: ClaseRealizada; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const dias = DIAS_HABILES.filter((d) => c.dias.includes(d.clave));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver historial de ${nombreClase(c)}, ${c.turnoDescripcion}`}
      onPress={onPress}
      style={({ pressed }) => [s.item, pressed && { opacity: 0.85 }]}
    >
      <View style={[s.fila, { justifyContent: 'space-between' }]}>
        <Text weight="extrabold" size={20}>
          {nombreClase(c)}
        </Text>
        {!!c.turnoDescripcion && <Badge label={c.turnoDescripcion} />}
      </View>
      {!!c.enfasis.length && (
        <Text size={12} color={colors.mutedForeground}>
          Énfasis: {c.enfasis.join(', ')}
        </Text>
      )}
      <View style={s.dias} accessibilityLabel={dias.length ? `Días con marcaciones: ${dias.map((d) => d.largo).join(', ')}` : 'Sin días de lunes a viernes'}>
        {DIAS_HABILES.map((d) => {
          const on = c.dias.includes(d.clave);
          return (
            <View key={d.clave} style={[s.dia, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text size={11} weight="bold" color={on ? colors.primaryForeground : colors.mutedForeground}>
                {d.corto}
              </Text>
            </View>
          );
        })}
      </View>
      <Contadores marcaciones={c.marcaciones} desarrolladas={c.desarrolladas} />
      <Barra valor={porcentaje(c.desarrolladas, c.marcaciones)} />
      <View style={[s.fila, { justifyContent: 'flex-end', marginTop: 2 }]}>
        <History size={13} color={colors.primaryText} />
        <Text size={12} weight="semibold" color={colors.primaryText}>
          Ver historial
        </Text>
      </View>
    </Pressable>
  );
}

/* --------------------------------- Página 6 -------------------------------- */

type FiltroSiNo = 'todas' | 'si' | 'no';

function Historial({ clase, institucion, filas, onEditar }: { clase: ClaseRealizada; institucion: string; filas: IntervencionRealizada[]; onEditar: (id: number) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [filtro, setFiltro] = useState<FiltroSiNo>('todas');
  const [manual, setManual] = useState<string | null>(null);
  const [cuantas, setCuantas] = useState(POR_PAGINA);

  const si = filas.filter((f) => f.desarrollada).length;
  const manuales = [...new Set(filas.map((f) => f.manual).filter((m): m is string => !!m))];
  const visibles = filas.filter((f) => (filtro === 'todas' || (filtro === 'si') === f.desarrollada) && (manual === null || f.manual === manual));
  const pagina = visibles.slice(0, cuantas);

  // Agrupadas por mes, en el mismo orden (más nueva primero).
  const meses: { clave: string; titulo: string; filas: IntervencionRealizada[] }[] = [];
  for (const f of pagina) {
    const clave = f.fecha ? `${f.fecha.getFullYear()}-${f.fecha.getMonth()}` : 'sin-fecha';
    let grupo = meses[meses.length - 1];
    if (!grupo || grupo.clave !== clave) {
      grupo = { clave, titulo: f.fecha ? `${nombreMes(f.fecha.getMonth())} ${f.fecha.getFullYear()}` : 'Sin fecha', filas: [] };
      meses.push(grupo);
    }
    grupo.filas.push(f);
  }

  const cambiarFiltro = (aplicar: () => void) => {
    aplicar();
    setCuantas(POR_PAGINA);
  };

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Text weight="extrabold" size={20}>
          {nombreClase(clase)}
          {clase.turnoDescripcion ? ` · ${clase.turnoDescripcion}` : ''}
        </Text>
        <View style={[s.fila, { marginTop: 4 }]}>
          <Building2 size={13} color={colors.mutedForeground} />
          <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>
            {institucion}
          </Text>
        </View>
        <View style={[s.fila, { marginTop: 14, gap: 12 }]}>
          <Dato valor={filas.length} etiqueta="Marcaciones" color={colors.primaryText} />
          <Dato valor={si} etiqueta="Desarrolladas" color={colors.success} />
          <Dato valor={filas.length - si} etiqueta="No desarrolladas" color={colors.accent} />
        </View>
        <Barra valor={porcentaje(si, filas.length)} />
        <Text size={11} color={colors.mutedForeground} style={{ marginTop: 6 }}>
          {porcentaje(si, filas.length)}% de las clases marcadas se desarrollaron
        </Text>
      </Card>

      <View style={s.segmento} accessibilityRole="tablist">
        {(
          [
            ['todas', 'Todas'],
            ['si', 'Desarrolladas'],
            ['no', 'No desarrolladas'],
          ] as const
        ).map(([v, l]) => (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: filtro === v }} onPress={() => cambiarFiltro(() => setFiltro(v))} style={[s.segmentoOp, filtro === v && s.segmentoActivo]}>
            <Text size={12} weight={filtro === v ? 'bold' : 'medium'} color={filtro === v ? colors.primaryText : colors.mutedForeground}>
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      {manuales.length > 1 && (
        <View style={s.chips}>
          <Chip etiqueta="Todos los manuales" activo={manual === null} onPress={() => cambiarFiltro(() => setManual(null))} />
          {manuales.map((m) => (
            <Chip key={m} etiqueta={m} color={COLOR_MANUAL[m]} activo={manual === m} onPress={() => cambiarFiltro(() => setManual(manual === m ? null : m))} />
          ))}
        </View>
      )}

      {!filas.length ? (
        <Vacio texto="Esta clase todavía no tiene intervenciones." />
      ) : !visibles.length ? (
        <Vacio texto="No hay intervenciones con este filtro." />
      ) : (
        <>
          {meses.map((m) => (
            <View key={m.clave} style={{ marginBottom: 8 }}>
              <Text size={11} weight="bold" color={colors.mutedForeground} style={s.mes}>
                {m.titulo.toUpperCase()}
              </Text>
              <View style={s.linea}>
                {m.filas.map((f) => (
                  <IntervencionItem key={f.id} f={f} onEditar={() => onEditar(f.id)} />
                ))}
              </View>
            </View>
          ))}
          {visibles.length > cuantas && <Button variant="outline" label={`Ver más (${visibles.length - cuantas} restantes)`} onPress={() => setCuantas((n) => n + POR_PAGINA)} />}
        </>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

function IntervencionItem({ f, onEditar }: { f: IntervencionRealizada; onEditar: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const color = (f.manual && COLOR_MANUAL[f.manual]) || colors.border;
  const tono = f.desarrollada ? colors.success : colors.accent;
  return (
    <View style={s.intervencion} accessibilityLabel={`${f.desarrollada ? 'Desarrollada' : 'No desarrollada'}${f.fecha ? `, ${diaYMes(f.fecha)}` : ''}`}>
      <View style={[s.marca, { backgroundColor: tono }]}>{f.desarrollada ? <Check size={13} color={colors.primaryForeground} /> : <X size={13} color={colors.primaryForeground} />}</View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={[s.fila, { justifyContent: 'space-between' }]}>
          <Text size={13} weight="bold" style={{ flex: 1 }}>
            {f.fecha ? `${diaYMes(f.fecha)} · ${pad(f.fecha.getHours())}:${pad(f.fecha.getMinutes())}` : 'Sin fecha'}
          </Text>
          <Text size={11} weight="bold" color={tono}>
            {f.desarrollada ? 'Sí' : 'No'}
          </Text>
        </View>
        {(f.manual || f.indice) && (
          <View style={[s.fila, { flexWrap: 'wrap' }]}>
            {f.manual && (
              <View style={[s.manual, { backgroundColor: alpha(color, colors.scheme === 'dark' ? 0.25 : 0.14) }]}>
                <View style={[s.punto, { backgroundColor: color }]} />
                <Text size={11} weight="bold">
                  {f.manual}
                </Text>
              </View>
            )}
            {f.indice && (
              <Text size={12} color={colors.foreground} style={{ flexShrink: 1 }}>
                {f.indice}
              </Text>
            )}
          </View>
        )}
        {f.observacion && (
          <Text size={12} color={colors.mutedForeground} style={{ fontStyle: 'italic' }}>
            “{f.observacion}”
          </Text>
        )}
        <View style={{ flexDirection: 'row' }}>
          <Button variant="ghost" size="sm" icon={Pencil} label="Editar" accessibilityLabel={`Editar intervención${f.fecha ? ` del ${diaYMes(f.fecha)}` : ''}`} onPress={onEditar} />
        </View>
      </View>
    </View>
  );
}

/* -------------------------------- Comunes ---------------------------------- */

function Migas({ items }: { items: { etiqueta: string; onPress?: () => void }[] }) {
  const { colors } = useTheme();
  const s = useStyles();
  if (!items.length) return null;
  return (
    <View style={s.migas} accessibilityRole="toolbar" accessibilityLabel="Ubicación">
      {items.map((m, k) => (
        <View key={k} style={[s.fila, { gap: 4, flexShrink: 1 }]}>
          {k > 0 && <ChevronRight size={13} color={colors.mutedForeground} />}
          {m.onPress ? (
            <Pressable accessibilityRole="link" onPress={m.onPress} hitSlop={6}>
              <Text size={12} weight="semibold" color={colors.primaryText} numberOfLines={1}>
                {m.etiqueta}
              </Text>
            </Pressable>
          ) : (
            <Text size={12} weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {m.etiqueta}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Contadores({ marcaciones, desarrolladas }: { marcaciones: number; desarrolladas: number }) {
  const { colors } = useTheme();
  return (
    <Text size={12} color={colors.mutedForeground}>
      <Text size={12} weight="bold">
        {marcaciones}
      </Text>
      {marcaciones === 1 ? ' marcación' : ' marcaciones'} ·{' '}
      <Text size={12} weight="bold" color={colors.success}>
        {porcentaje(desarrolladas, marcaciones)}%
      </Text>{' '}
      desarrolladas
    </Text>
  );
}

function Barra({ valor }: { valor: number }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.barra} accessibilityLabel={`${valor}% desarrolladas`}>
      <View style={[s.barraFill, { width: `${valor}%`, backgroundColor: colors.success }]} />
    </View>
  );
}

function Dato({ valor, etiqueta, color }: { valor: number; etiqueta: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text weight="bold" size={22} color={color}>
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

function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
      <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
        {/not found/i.test(mensaje) ? FALTA_PUBLICAR : mensaje}
      </Text>
      <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={onReintentar} />
    </Card>
  );
}

function Cargando({ texto }: { texto: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.centro}>
      <ActivityIndicator color={colors.primaryText} />
      <Text color={colors.mutedForeground}>{texto}</Text>
    </View>
  );
}

function Vacio({ texto }: { texto: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.centro}>
      <History size={24} color={colors.mutedForeground} />
      <Text color={colors.mutedForeground} style={{ textAlign: 'center' }}>
        {texto}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    centro: { paddingVertical: 48, alignItems: 'center', gap: 12 },
    columnas: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    item: { gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, ...c.shadow },
    grid: { gap: 12, justifyContent: 'space-between' },
    dias: { flexDirection: 'row', gap: 6 },
    dia: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' },
    barra: { height: 6, borderRadius: 3, backgroundColor: c.muted, marginTop: 4, overflow: 'hidden' },
    barraFill: { height: 6, borderRadius: 3 },
    migas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginBottom: 14 },
    segmento: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: c.muted, borderRadius: radius.lg, marginBottom: 12 },
    segmentoOp: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingHorizontal: 4, borderRadius: radius.md },
    segmentoActivo: { backgroundColor: c.card, ...c.shadow },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    punto: { width: 8, height: 8, borderRadius: 4 },
    mes: { letterSpacing: 1, marginBottom: 8, marginTop: 4 },
    linea: { borderLeftWidth: 2, borderLeftColor: c.border, marginLeft: 11, paddingLeft: 0 },
    intervencion: { flexDirection: 'row', gap: 12, marginLeft: -12, paddingBottom: 16 },
    marca: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    manual: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md },
  }),
);
