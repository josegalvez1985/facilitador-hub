import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Download, Eye, FileText, ImageDown, RefreshCw, TriangleAlert, ZoomIn, ZoomOut } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { hoy, nombreMes } from '../fechas';
import { documentoAcuerdo, faltantesAcuerdo } from '../formularios/acuerdo';
import { cargarBloqueo, cargarInstitucion, cargarIntervenciones, cargarMisPostulaciones, FALTA_PUBLICAR, faltaPublicar, type MisPostulaciones } from '../formularios/datos';
import { documentoForm1 } from '../formularios/form1';
import { armarClases, documentoForm2, textoEtapa } from '../formularios/form2';
import { armarAgenda, documentoForm3 } from '../formularios/form3';
import { HojaNativa, type HojaNativaRef } from '../formularios/hoja-nativa';
import { cargarJsPdf, type Lamina } from '../formularios/pintor';
import type { Documento } from '../formularios/planilla';
import { Cancelado, cargarImagenesAcuerdo, cargarLogo, descargarPdf, sacarImagen, sacarPdf } from '../formularios/salida';
import { LaminaSvg } from '../formularios/vista';
import { makeStyles, useTheme } from '../theme-provider';
import { useToast } from '../toast';
import { Button, Card, PageTitle, Text, SinFacilitador } from '../ui';

/** 4 = el Acuerdo de cooperación (solo PDF). */
type NroForm = 1 | 2 | 3 | 4;

const FORMS: { n: NroForm; corto: string; titulo: string; detalle: string }[] = [
  { n: 1, corto: 'Form. 1', titulo: 'Postulación anual', detalle: 'Tus clases en una institución: grados, manuales, horarios y docentes.' },
  { n: 2, corto: 'Form. 2', titulo: 'Reporte diario', detalle: 'Tus clases en una institución con las intervenciones de un mes o una etapa.' },
  { n: 3, corto: 'Form. 3', titulo: 'Agenda semanal', detalle: 'Tu semana por turno, con tus horarios bloqueados en rojo.' },
  { n: 4, corto: 'Acuerdo', titulo: 'Cooperación', detalle: 'El acuerdo de cooperación con una de tus instituciones, en PDF, con los datos de su director/a.' },
];

type Periodo = { tipo: 'mes'; mes: number } | { tipo: 'etapa'; inicio: string; fin: string; n: number };

type Base = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; datos: MisPostulaciones };
type Hoja = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; doc: Documento; lamina: Lamina; avisos: string[] } | { tipo: 'vacio'; mensaje: string };

const dos = (n: number) => String(n).padStart(2, '0');
/** "2026-04-20" → "20/04". */
const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Desde y hasta (`YYYY-MM-DD`) del período elegido. */
function rango(anio: string, p: Periodo) {
  if (p.tipo === 'etapa') return { desde: p.inicio, hasta: p.fin, etapa: textoEtapa(p.inicio, p.fin, p.n) };
  const ultimo = new Date(Number(anio), p.mes + 1, 0).getDate();
  const desde = `${anio}-${dos(p.mes + 1)}-01`;
  const hasta = `${anio}-${dos(p.mes + 1)}-${dos(ultimo)}`;
  return { desde, hasta, etapa: textoEtapa(desde, hasta) };
}

const mensajeDe = (e: unknown, alterno: string) => {
  const m = e instanceof Error ? e.message : alterno;
  return faltaPublicar(m) ? FALTA_PUBLICAR : m;
};

export function FormulariosScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const toast = useToast();
  const { sesion, facilitador, reintentarFacilitador } = useSession();

  const [form, setForm] = useState<NroForm>(1);
  const [anioPedido, setAnioPedido] = useState<string | null>(null);
  const [inst, setInst] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'mes', mes: hoy().getMonth() });
  const [intento, setIntento] = useState(0);
  const [base, setBase] = useState<{ clave: string } & Base>({ clave: '', tipo: 'cargando' });
  const [hoja, setHoja] = useState<{ clave: string } & Hoja>({ clave: '', tipo: 'cargando' });
  const [ancho, setAncho] = useState(0);
  const [grande, setGrande] = useState(false);
  const [ocupado, setOcupado] = useState<'pdf' | 'imagen' | 'descargar' | null>(null);
  const hojaNativa = useRef<HojaNativaRef>(null);
  const esWeb = Platform.OS === 'web';

  // Sin ID_FACILITADOR no se piden datos: el servidor saca el facilitador del token.
  const id = facilitador.estado === 'listo' ? facilitador.id : null;

  /* ---- Las postulaciones del año (para las listas y el Form. 3) ---- */

  const claveBase = `${id}-${anioPedido ?? ''}-${intento}`;
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarMisPostulaciones(anioPedido ?? undefined)
      .then((datos) => vigente && setBase({ clave: claveBase, tipo: 'listo', datos }))
      .catch((e: unknown) => vigente && setBase({ clave: claveBase, tipo: 'error', mensaje: mensajeDe(e, 'No se pudieron cargar tus clases') }));
    return () => {
      vigente = false;
    };
  }, [id, anioPedido, intento, claveBase]);

  const b: Base = base.clave === claveBase ? base : { tipo: 'cargando' };
  const datos = b.tipo === 'listo' ? b.datos : null;
  const anio = datos?.anio ?? anioPedido ?? '';

  const anios = useMemo(() => [...new Set([datos?.anioActual ?? '', ...(datos?.anios ?? []), anio])].filter(Boolean).sort((x, y) => y.localeCompare(x)), [datos, anio]);

  const instituciones = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of datos?.postulaciones ?? []) if (!m.has(p.idInstitucion)) m.set(p.idInstitucion, p.institucion);
    return [...m].map(([idI, nombre]) => ({ id: idI, nombre }));
  }, [datos]);
  const instElegida = instituciones.some((i) => i.id === inst) ? inst : (instituciones[0]?.id ?? null);

  const etapas = useMemo(() => (datos?.etapas ?? []).filter((e) => e.inicio.startsWith(anio)).map((e, i) => ({ ...e, n: i + 1 })), [datos, anio]);

  /* ---- El formulario elegido ---- */

  const { desde, hasta, etapa } = rango(anio, periodo);
  const claveHoja = `${claveBase}|${form}|${anio}|${form === 3 ? '' : instElegida}|${form === 2 ? `${desde}|${hasta}` : ''}`;
  useEffect(() => {
    if (!datos) return;
    let vigente = true;
    const listo = (doc: Documento, avisos: string[]) => vigente && setHoja({ clave: claveHoja, tipo: 'listo', doc, lamina: doc.lamina(), avisos });
    const armar = async () => {
      await cargarJsPdf();
      if (form === 3) {
        const agenda = armarAgenda({ anio, facilitador: datos.facilitador.nombre || sesion?.nombre || '', postulaciones: datos.postulaciones, bloqueo: await cargarBloqueo(anio) });
        const avisos = [
          agenda.noche ? `${agenda.noche} ${agenda.noche === 1 ? 'clase de la noche no sale' : 'clases de la noche no salen'}: el formulario es de mañana y tarde.` : '',
          agenda.sinHorario ? `${agenda.sinHorario} ${agenda.sinHorario === 1 ? 'clase no tiene' : 'clases no tienen'} día ni hora y no ${agenda.sinHorario === 1 ? 'sale' : 'salen'}.` : '',
          agenda.bloqueoIlegible.length ? `No se pudo leer parte de tus horarios bloqueados: ${agenda.bloqueoIlegible.join('; ')}.` : '',
        ];
        return listo(documentoForm3(agenda), avisos.filter(Boolean));
      }
      if (instElegida === null) return vigente && setHoja({ clave: claveHoja, tipo: 'vacio', mensaje: `No tenés clases activas en ${anio}.` });
      if (form === 1) {
        const f = await cargarInstitucion(instElegida, anio);
        return listo(documentoForm1(f), []);
      }
      if (form === 4) {
        // Solo instituciones donde tiene clases: el servidor responde 404 por cualquier otra.
        const [f, img] = await Promise.all([cargarInstitucion(instElegida, anio), cargarImagenesAcuerdo()]);
        const x = { institucion: f, anio };
        return listo(documentoAcuerdo(x, img), faltantesAcuerdo(x));
      }
      const [f, intervenciones, logo] = await Promise.all([cargarInstitucion(instElegida, anio), cargarIntervenciones(instElegida, desde, hasta), cargarLogo()]);
      const clases = armarClases(f.detalle, intervenciones, desde, hasta);
      const sobran = clases.filter((c) => c.sobran > 0);
      const avisos = sobran.length
        ? [`${sobran.length === 1 ? 'Una clase tuvo' : `${sobran.length} clases tuvieron`} más de 4 intervenciones en el período: salen las primeras 4.`]
        : [];
      const doc = documentoForm2(
        { anio, desde, hasta, etapa, institucion: f, autoridades: f.autoridades, facilitador: { nombre: datos.facilitador.nombre || sesion?.nombre || '', telefono: datos.facilitador.telefono }, clases },
        logo,
      );
      return listo(doc, avisos);
    };
    armar().catch((e: unknown) => vigente && setHoja({ clave: claveHoja, tipo: 'error', mensaje: mensajeDe(e, 'No se pudo armar el formulario') }));
    return () => {
      vigente = false;
    };
  }, [claveHoja, datos, form, anio, instElegida, desde, hasta, etapa, sesion?.nombre]);

  const h: Hoja = hoja.clave === claveHoja ? hoja : { tipo: 'cargando' };

  const recargar = () => {
    if (facilitador.estado === 'error') reintentarFacilitador();
    else setIntento((n) => n + 1);
  };

  // En la web la pestaña tiene que abrirse dentro del toque: sacarPdf/sacarImagen van sin await previo.
  const sacar = (que: 'pdf' | 'imagen' | 'descargar') => {
    if (h.tipo !== 'listo' || ocupado) return;
    setOcupado(que);
    const hoja = hojaNativa.current;
    const trabajo = que === 'pdf' ? sacarPdf(h.doc) : que === 'descargar' ? descargarPdf(h.doc) : sacarImagen(h.doc, h.lamina, hoja ? () => hoja.rasterizar() : undefined);
    trabajo
      .then(() => {
        if (que === 'descargar') toast.success('PDF descargado', { description: `${h.doc.archivo}.pdf` });
      })
      .catch((e: unknown) => {
        if (e instanceof Cancelado) return;
        toast.error(que === 'imagen' ? 'No se pudo generar la imagen' : que === 'descargar' ? 'No se pudo descargar el PDF' : 'No se pudo generar el PDF', {
          description: e instanceof Error ? e.message : undefined,
        });
      })
      .finally(() => setOcupado(null));
  };

  const encabezado = (
    <PageTitle title="Formularios" subtitle="Tus Form. 1, 2 y 3 y el Acuerdo de cooperación, solo con tus clases.">
      <Button size="icon" variant="outline" icon={RefreshCw} accessibilityLabel="Actualizar formularios" onPress={recargar} disabled={facilitador.estado === 'cargando'} />
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
    return (
      <>
        {encabezado}
        <SinFacilitador />
      </>
    );
  }

  const elegido = FORMS.find((f) => f.n === form)!;

  return (
    <>
      {encabezado}

      <View style={s.tabs} accessibilityRole="tablist">
        {FORMS.map((f) => {
          const activo = f.n === form;
          return (
            <Pressable key={f.n} accessibilityRole="tab" accessibilityState={{ selected: activo }} accessibilityLabel={`${f.corto}: ${f.titulo}`} onPress={() => setForm(f.n)} style={[s.tab, activo && s.tabActivo]}>
              <Text size={13} weight="bold" color={activo ? colors.primaryForeground : colors.foreground}>
                {f.corto}
              </Text>
              <Text size={11} color={activo ? colors.primaryForeground : colors.mutedForeground}>
                {f.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={s.card}>
        <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 19 }}>
          {elegido.detalle}
        </Text>

        {b.tipo === 'cargando' && <Cargando texto="Cargando tus clases…" />}
        {b.tipo === 'error' && <ErrorCard mensaje={b.mensaje} onReintentar={recargar} />}

        {datos && (
          <>
            <Filtro titulo="Año lectivo">
              {anios.map((a) => (
                <Chip key={a} etiqueta={a} activo={a === anio} onPress={() => a !== anio && setAnioPedido(a)} />
              ))}
            </Filtro>

            {form !== 3 && (
              <Filtro titulo="Institución">
                {instituciones.length ? (
                  instituciones.map((i) => <Chip key={i.id} etiqueta={i.nombre} activo={i.id === instElegida} onPress={() => setInst(i.id)} />)
                ) : (
                  <Text size={12} color={colors.mutedForeground}>
                    No tenés clases activas en {anio}.
                  </Text>
                )}
              </Filtro>
            )}

            {form === 2 && (
              <>
                <Filtro titulo="Mes">
                  {Array.from({ length: 12 }, (_, m) => (
                    <Chip key={m} etiqueta={nombreMes(m)} activo={periodo.tipo === 'mes' && periodo.mes === m} onPress={() => setPeriodo({ tipo: 'mes', mes: m })} />
                  ))}
                </Filtro>
                {etapas.length > 0 && (
                  <Filtro titulo="O una etapa">
                    {etapas.map((e) => (
                      <Chip
                        key={e.inicio + e.fin}
                        etiqueta={`${e.n}ª etapa · ${ddmm(e.inicio)} al ${ddmm(e.fin)}`}
                        activo={periodo.tipo === 'etapa' && periodo.inicio === e.inicio && periodo.fin === e.fin}
                        onPress={() => setPeriodo({ tipo: 'etapa', inicio: e.inicio, fin: e.fin, n: e.n })}
                      />
                    ))}
                  </Filtro>
                )}
                <Text size={12} color={colors.mutedForeground}>
                  Período: {ddmm(desde)}/{desde.slice(0, 4)} al {ddmm(hasta)}/{hasta.slice(0, 4)}
                </Text>
              </>
            )}
          </>
        )}
      </Card>

      {datos && (
        <Card style={s.card}>
          <View style={s.fila}>
            <Text weight="semibold" size={14} style={{ flex: 1 }}>
              Vista previa
            </Text>
            {h.tipo === 'listo' && esWeb && (
              <Button size="sm" variant="ghost" icon={grande ? ZoomOut : ZoomIn} label={grande ? 'Achicar' : 'Ampliar'} onPress={() => setGrande(!grande)} />
            )}
            {h.tipo === 'listo' && !esWeb && (
              <Text size={11} color={colors.mutedForeground}>
                Pellizcá para ampliar
              </Text>
            )}
          </View>

          <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
            {h.tipo === 'cargando' && <Cargando texto="Armando el formulario…" />}
            {h.tipo === 'error' && <ErrorCard mensaje={h.mensaje} onReintentar={recargar} />}
            {h.tipo === 'vacio' && (
              <Text color={colors.mutedForeground} style={{ textAlign: 'center', paddingVertical: 32 }}>
                {h.mensaje}
              </Text>
            )}
            {h.tipo === 'listo' && ancho > 0 && esWeb && (
              <ScrollView horizontal={grande} scrollEnabled={grande} style={s.hoja} accessibilityLabel={`Vista previa del ${h.doc.archivo}`}>
                <LaminaSvg lamina={h.lamina} ancho={grande ? Math.max(ancho * 3, 1400) : ancho - 2} />
              </ScrollView>
            )}
            {/* En el APK, un WebView: react-native-svg dibuja la hoja en el hilo principal y la app no respondía. */}
            {h.tipo === 'listo' && ancho > 0 && !esWeb && (
              <View style={s.hoja} accessibilityLabel={`Vista previa del ${h.doc.archivo}`}>
                <HojaNativa ref={hojaNativa} lamina={h.lamina} ancho={ancho - 2} />
              </View>
            )}
          </View>

          {h.tipo === 'listo' &&
            h.avisos.map((a) => (
              <View key={a} style={s.aviso}>
                <TriangleAlert size={14} color={colors.mutedForeground} />
                <Text size={12} color={colors.mutedForeground} style={{ flex: 1, lineHeight: 18 }}>
                  {a}
                </Text>
              </View>
            ))}

          {form === 4 ? (
            <>
              {/* El Acuerdo sale solo en PDF: verlo o descargarlo. */}
              <View style={s.acciones}>
                <Button icon={Eye} label={ocupado === 'pdf' ? 'Generando…' : 'Ver PDF'} onPress={() => sacar('pdf')} disabled={h.tipo !== 'listo' || ocupado !== null} style={{ flex: 1 }} />
                <Button variant="outline" icon={Download} label={ocupado === 'descargar' ? 'Generando…' : 'Descargar'} onPress={() => sacar('descargar')} disabled={h.tipo !== 'listo' || ocupado !== null} style={{ flex: 1 }} />
              </View>
              <Text size={11} color={colors.mutedForeground} style={{ textAlign: 'center', lineHeight: 16 }}>
                {esWeb ? 'Ver PDF lo abre en una pestaña nueva; Descargar lo guarda en tu equipo.' : 'Ver PDF abre el menú para elegir un visor; Descargar te deja elegir la carpeta donde guardarlo.'}
              </Text>
            </>
          ) : (
            <>
              <View style={s.acciones}>
                <Button icon={FileText} label={ocupado === 'pdf' ? 'Generando…' : 'PDF'} onPress={() => sacar('pdf')} disabled={h.tipo !== 'listo' || ocupado !== null} style={{ flex: 1 }} />
                <Button variant="outline" icon={ImageDown} label={ocupado === 'imagen' ? 'Generando…' : 'Imagen'} onPress={() => sacar('imagen')} disabled={h.tipo !== 'listo' || ocupado !== null} style={{ flex: 1 }} />
              </View>
              <Text size={11} color={colors.mutedForeground} style={{ textAlign: 'center', lineHeight: 16 }}>
                {esWeb ? 'Se abre en una pestaña nueva (o se descarga).' : 'Se abre el menú para compartir: elegí un visor, guardalo o mandalo.'}
              </Text>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function Filtro({ titulo, children }: { titulo: string; children: ReactNode }) {
  const s = useStyles();
  return (
    <View style={{ gap: 8 }}>
      <Text size={12} weight="semibold">
        {titulo}
      </Text>
      <View style={s.chips}>{children}</View>
    </View>
  );
}

function Chip({ etiqueta, activo, onPress }: { etiqueta: string; activo: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} accessibilityState={{ selected: activo }} onPress={onPress} style={[s.chip, activo && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text size={12} weight={activo ? 'bold' : 'medium'} color={activo ? colors.primaryForeground : colors.foreground}>
        {etiqueta}
      </Text>
    </Pressable>
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

function ErrorCard({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
      <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
        {mensaje}
      </Text>
      <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={onReintentar} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: 'center', gap: 2 },
    tabActivo: { backgroundColor: c.primary, borderColor: c.primary },
    card: { gap: 14, marginBottom: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    centro: { paddingVertical: 40, alignItems: 'center', gap: 12 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hoja: { borderWidth: 1, borderColor: c.border, borderRadius: 6 },
    aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    acciones: { flexDirection: 'row', gap: 10 },
  }),
);
