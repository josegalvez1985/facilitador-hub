// "Historial de intervenciones" = página 7 de APEX 193573 (búsqueda facetada sobre
// V_HISTORIAL_INTERVENCIONES), con "Editar" = página 8 (ver editar-intervencion.tsx).
// - Buscador: busca en fecha, manual, observación, Sí/No, institución, grado, énfasis.
// - Faceta Mes: arranca en el mes actual (P7_MES = TO_CHAR(SYSDATE,'Month')).
// - Faceta Fecha: los días del mes elegido, con su cantidad.
// - Restablecer vuelve a esos valores. Se ven de a 50, como el reporte.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Building2, Check, History, Pencil, RefreshCw, RotateCcw, Search, X } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { EditarIntervencion } from '../editar-intervencion';
import { DIAS, diaYMes, hoy, nombreMes } from '../fechas';
import { cargarHistorialIntervenciones, textoBusqueda, type IntervencionHistorial } from '../historial';
import { COLOR_MANUAL } from '../intervenciones';
import { alpha, radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { Button, Card, PageTitle, Text, SinFacilitador } from '../ui';

const POR_PAGINA = 50;

type Resultado = { clave: string } & ({ tipo: 'error'; mensaje: string } | { tipo: 'listo'; filas: IntervencionHistorial[] });

const claveMes = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function HistorialScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const { facilitador, reintentarFacilitador } = useSession();
  const [busqueda, setBusqueda] = useState('');
  const [mes, setMes] = useState<string | null>(() => claveMes(hoy()));
  const [dia, setDia] = useState<string | null>(null);
  const [cuantas, setCuantas] = useState(POR_PAGINA);
  const [editar, setEditar] = useState<number | null>(null);

  // Sin ID_FACILITADOR no se piden datos (aislamiento entre facilitadores).
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarHistorialIntervenciones()
      .then((filas) => vigente && setResultado({ clave: `${id}`, tipo: 'listo', filas }))
      .catch((e: unknown) => vigente && setResultado({ clave: `${id}`, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar el historial' }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);
  // Al refrescar después de editar se sigue mostrando la lista anterior hasta que llega la nueva.
  const r = resultado && resultado.clave === `${id}` ? resultado : null;
  const recargar = () => (facilitador.estado === 'error' ? reintentarFacilitador() : setIntento((n) => n + 1));

  const encabezado = <PageTitle title="Historial de intervenciones" subtitle="Buscá, filtrá y corregí tus marcaciones del año lectivo." />;

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
            {/not found/i.test(mensaje) ? 'Falta publicar en el backend los endpoints de historial-intervenciones (sql/historial_app_ethos.sql).' : mensaje}
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
          <Text color={colors.mutedForeground}>Cargando tu historial…</Text>
        </View>
      </>
    );
  }

  // Facetas: cada una cuenta con los demás filtros aplicados (como la búsqueda facetada de APEX).
  const q = busqueda.trim().toLowerCase();
  const buscadas = q ? r.filas.filter((f) => textoBusqueda(f).includes(q)) : r.filas;
  const meses = contar(buscadas, (f) => (f.fecha ? claveMes(f.fecha) : null), (f) => `${nombreMes(f.fecha!.getMonth())} ${f.fecha!.getFullYear()}`);
  const delMes = mes ? buscadas.filter((f) => f.fecha && claveMes(f.fecha) === mes) : buscadas;
  const dias = contar(delMes, (f) => (f.fecha ? claveDia(f.fecha) : null), (f) => `${(DIAS[f.fecha!.getDay()] ?? '').slice(0, 3)} ${f.fecha!.getDate()}`);
  const visibles = dia ? delMes.filter((f) => f.fecha && claveDia(f.fecha) === dia) : delMes;
  const pagina = visibles.slice(0, cuantas);
  const mesActual = claveMes(hoy());
  const filtrado = !!q || mes !== mesActual || dia !== null;

  // El mes elegido puede no tener intervenciones (p. ej. el actual al empezar): se muestra igual, en 0.
  if (mes && !meses.some((m) => m.clave === mes)) {
    const [y, m] = mes.split('-').map(Number);
    meses.unshift({ clave: mes, etiqueta: `${nombreMes(m ?? 0)} ${y}`, n: 0 });
  }

  const conPaginaInicial = (aplicar: () => void) => {
    aplicar();
    setCuantas(POR_PAGINA);
  };
  const restablecer = () =>
    conPaginaInicial(() => {
      setBusqueda('');
      setMes(mesActual);
      setDia(null);
    });

  // Agrupadas por día, en el orden del reporte (ID_INTERVENCION desc).
  const grupos: { clave: string; titulo: string; filas: IntervencionHistorial[] }[] = [];
  for (const f of pagina) {
    const clave = f.fecha ? claveDia(f.fecha) : 'sin-fecha';
    let g = grupos.find((x) => x.clave === clave);
    if (!g) {
      g = { clave, titulo: f.fecha ? diaYMes(f.fecha) : 'Sin fecha', filas: [] };
      grupos.push(g);
    }
    g.filas.push(f);
  }

  return (
    <>
      {encabezado}

      <View style={s.buscador}>
        <Search size={16} color={colors.mutedForeground} />
        <TextInput
          value={busqueda}
          onChangeText={(t) => conPaginaInicial(() => setBusqueda(t))}
          placeholder="Buscar por institución, manual, grado, observación…"
          placeholderTextColor={colors.mutedForeground}
          keyboardAppearance={colors.scheme}
          autoCorrect={false}
          style={s.buscadorInput}
          accessibilityLabel="Buscar"
        />
        {!!busqueda && (
          <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => conPaginaInicial(() => setBusqueda(''))} hitSlop={8}>
            <X size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <Text size={11} weight="bold" color={colors.mutedForeground} style={s.faceta}>
        MES
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ flexGrow: 0, marginBottom: 12 }}>
        <Chip etiqueta="Todos" activo={mes === null} onPress={() => conPaginaInicial(() => {
            setMes(null);
            setDia(null);
          })} />
        {meses.map((m) => (
          <Chip key={m.clave} etiqueta={m.etiqueta} n={m.n} activo={mes === m.clave} onPress={() => conPaginaInicial(() => {
                setMes(mes === m.clave ? null : m.clave);
                setDia(null);
              })} />
        ))}
      </ScrollView>

      {dias.length > 1 && (
        <>
          <Text size={11} weight="bold" color={colors.mutedForeground} style={s.faceta}>
            FECHA
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ flexGrow: 0, marginBottom: 12 }}>
            <Chip etiqueta="Todos los días" activo={dia === null} onPress={() => conPaginaInicial(() => setDia(null))} />
            {dias.map((d) => (
              <Chip key={d.clave} etiqueta={d.etiqueta} n={d.n} activo={dia === d.clave} onPress={() => conPaginaInicial(() => setDia(dia === d.clave ? null : d.clave))} />
            ))}
          </ScrollView>
        </>
      )}

      <View style={[s.fila, { justifyContent: 'space-between', marginBottom: 12 }]}>
        <Text size={13} color={colors.mutedForeground}>
          <Text size={13} weight="bold">
            {visibles.length}
          </Text>
          {visibles.length === 1 ? ' intervención' : ' intervenciones'}
        </Text>
        {filtrado && <Button variant="ghost" size="sm" icon={RotateCcw} label="Restablecer" onPress={restablecer} />}
      </View>

      {!visibles.length ? (
        <Vacio texto="No se ha encontrado ningún dato" />
      ) : (
        <>
          {grupos.map((g) => (
            <View key={g.clave} style={{ marginBottom: 14 }}>
              <Text size={11} weight="bold" color={colors.mutedForeground} style={s.faceta}>
                {g.titulo.toUpperCase()}
              </Text>
              <View style={{ gap: 10 }}>
                {g.filas.map((f) => (
                  <Item key={f.id} f={f} onEditar={() => setEditar(f.id)} />
                ))}
              </View>
            </View>
          ))}
          {visibles.length > cuantas && <Button variant="outline" label={`Ver más (${visibles.length - cuantas} restantes)`} onPress={() => setCuantas((n) => n + POR_PAGINA)} />}
        </>
      )}

      {/* Como el "apexafterclosedialog" de la página: al guardar se refresca la lista. */}
      <EditarIntervencion id={editar} onClose={() => setEditar(null)} onGuardada={() => setIntento((n) => n + 1)} />
    </>
  );
}

/** Valores de una faceta con su cantidad, en el orden en que aparecen (más nuevo primero). */
function contar(filas: IntervencionHistorial[], clave: (f: IntervencionHistorial) => string | null, etiqueta: (f: IntervencionHistorial) => string) {
  const m = new Map<string, { clave: string; etiqueta: string; n: number }>();
  for (const f of filas) {
    const k = clave(f);
    if (k === null) continue;
    const v = m.get(k);
    if (v) v.n++;
    else m.set(k, { clave: k, etiqueta: etiqueta(f), n: 1 });
  }
  return [...m.values()];
}

function Item({ f, onEditar }: { f: IntervencionHistorial; onEditar: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const si = f.siNo === 'Si';
  const tono = si ? colors.success : colors.accent;
  const color = (f.manual && COLOR_MANUAL[f.manual]) || colors.border;
  return (
    <Card style={[s.item, { borderLeftColor: color }]}>
      <View style={[s.fila, { justifyContent: 'space-between' }]}>
        <View style={s.fila}>
          <Text weight="extrabold" size={16}>
            {f.hora}
          </Text>
          <View style={[s.sino, { backgroundColor: alpha(tono, colors.scheme === 'dark' ? 0.25 : 0.14) }]}>
            {si ? <Check size={12} color={tono} /> : <X size={12} color={tono} />}
            <Text size={11} weight="bold" color={colors.foreground}>
              {si ? 'Desarrollada' : 'No desarrollada'}
            </Text>
          </View>
        </View>
        <Button variant="ghost" size="sm" icon={Pencil} label="Editar" accessibilityLabel={`Editar intervención de las ${f.hora}${f.fecha ? ` del ${diaYMes(f.fecha)}` : ''}`} onPress={onEditar} />
      </View>

      {(f.manual || f.indice) && (
        <View style={[s.fila, { flexWrap: 'wrap', marginTop: 8 }]}>
          {f.manual && (
            <View style={[s.manual, { backgroundColor: alpha(color, colors.scheme === 'dark' ? 0.25 : 0.14) }]}>
              <View style={[s.punto, { backgroundColor: color }]} />
              <Text size={11} weight="bold">
                {f.manual}
              </Text>
            </View>
          )}
          {f.indice && (
            <Text size={13} weight="semibold" style={{ flexShrink: 1 }}>
              {f.indice}
            </Text>
          )}
        </View>
      )}

      <View style={[s.fila, { marginTop: 8, alignItems: 'flex-start' }]}>
        <Building2 size={13} color={colors.mutedForeground} style={{ marginTop: 2 }} />
        <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>
          {[f.institucion, f.grado, f.turno, f.enfasis].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {!si && f.motivo && (
        <Text size={12} style={{ marginTop: 6 }}>
          <Text size={12} weight="bold">
            Motivo:
          </Text>{' '}
          {f.motivo}
        </Text>
      )}
      {f.observacion && (
        <Text size={12} color={colors.mutedForeground} style={{ marginTop: 6, fontStyle: 'italic' }}>
          “{f.observacion}”
        </Text>
      )}
    </Card>
  );
}

function Chip({ etiqueta, n, activo, onPress }: { etiqueta: string; n?: number; activo: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Filtrar ${etiqueta}`} accessibilityState={{ selected: activo }} onPress={onPress} style={[s.chip, activo && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text size={12} weight={activo ? 'bold' : 'medium'} color={activo ? colors.primaryForeground : colors.foreground}>
        {etiqueta}
      </Text>
      {n !== undefined && (
        <View style={[s.contador, activo && { backgroundColor: colors.primaryForeground }]}>
          <Text size={10} weight="bold" color={activo ? colors.primary : colors.mutedForeground}>
            {n}
          </Text>
        </View>
      )}
    </Pressable>
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
    fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, marginBottom: 14, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.card },
    buscadorInput: { flex: 1, minHeight: 44, color: c.foreground, fontSize: 15 },
    faceta: { letterSpacing: 1, marginBottom: 8 },
    chips: { gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    contador: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' },
    item: { borderLeftWidth: 4, marginBottom: 0 },
    sino: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    manual: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md },
    punto: { width: 8, height: 8, borderRadius: 4 },
  }),
);
