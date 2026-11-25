import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { ArrowRight, ArrowUpRight, BookOpen, Building2, CalendarDays, Check, CheckCheck, ChevronRight, CircleSlash, FileText, GraduationCap, type LucideIcon } from 'lucide-react-native';

import { cargarAgenda, clasesDelDia, diaAgenda } from '../agenda';
import { AvisoPostulacionInicio } from '../aviso-postulacion';
import { iniciales } from '../data';
import { useSession } from '../auth/session';
import { ClaseCard } from '../clase-agenda';
import { Cumpleanios } from '../cumpleanios';
import { GraficoSemanal } from '../grafico-semanal';
import { diaMesAbreviado, hoy, mismoDia, nombreMes, sumarDias } from '../fechas';
import { fraseDelDia } from '../frase-del-dia';
import { cargarRecientes, cargarResumen, type Resumen } from '../intervenciones';
import { MiniCalendar } from '../mini-calendar';
import { useApp } from '../provider';
import { useLayout } from '../shell';
import { alpha, radius, type Tone } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { AvatarAureola, Badge, Button, Card, Dot, PageTitle, SectionHeading, StatIcon, Text } from '../ui';

const classroom = require('../../../assets/images/classroom.jpg');

export function HomeScreen() {
  const app = useApp();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const { desktop, wide } = useLayout();
  const { facilitador } = useSession();
  // Con el facilitador ya resuelto y sin registro: Inicio muestra solo la invitación a la postulación.
  const sinFacilitador = facilitador.estado === 'listo' && facilitador.id === null;
  // KPIs del facilitador (marcaciones, materiales e instituciones): GET mis-intervenciones/resumen.
  const resumen = useDelFacilitador(cargarResumen);
  const mes = nombreMes(hoy().getMonth()).toLowerCase();
  const tint = colors.heroTint;
  const frase = fraseDelDia();

  // Agenda real (página 3 de APEX): KPI de la semana y "Tus clases de hoy".
  const agenda = useDelFacilitador(cargarAgenda);
  const clasesHoy = agenda.tipo === 'listo' ? clasesDelDia(agenda.datos.clases, diaAgenda(hoy())) : [];
  const clasesSemana = agenda.tipo === 'listo' ? agenda.datos.clases.reduce((n, c) => n + Object.keys(c.dias).length, 0) : 0;
  const kpiSemana: { value: string; note: ReactNode } =
    agenda.tipo === 'listo'
      ? { value: String(clasesSemana), note: <><Em>{clasesHoy.length} {clasesHoy.length === 1 ? 'clase' : 'clases'}</Em> para hoy</> }
      : agenda.tipo === 'cargando'
        ? { value: '…', note: 'Cargando…' }
        : { value: '—', note: agenda.tipo === 'sin-facilitador' ? 'Sin registro de facilitador' : agenda.mensaje.match(/not found/i) ? 'Falta publicar mi-agenda' : 'No disponible' };

  // "Actividad reciente": últimas intervenciones registradas (página 2).
  const recientes = useDelFacilitador(cargarRecientes);

  const stats: { label: string; value: string; note: ReactNode; icon: LucideIcon; tone: Tone }[] = [
    { label: 'Clases esta semana', ...kpiSemana, icon: CalendarDays, tone: 'primary' },
    { label: 'Marcaciones del mes', ...kpiDe(resumen, (d) => ({ value: String(d.delMes), note: <><Em>{d.desarrolladasDelMes} desarrolladas</Em> en {mes}</> })), icon: CheckCheck, tone: 'success' },
    { label: 'Materiales desarrollados', ...kpiDe(resumen, (d) => ({ value: String(d.indicesDesarrollados), note: <>índices · <Em>{d.manualesDesarrollados} {d.manualesDesarrollados === 1 ? 'manual completo' : 'manuales completos'}</Em></> })), icon: BookOpen, tone: 'accent' },
    { label: 'Instituciones', ...kpiDe(resumen, (d) => ({ value: String(d.instituciones), note: 'En el año lectivo actual' })), icon: Building2, tone: 'primary' },
  ];

  return (
    <>
      <PageTitle
        title={<>¡Buen día, {app.name.split(' ')[0]}! <Text size={27} color={colors.accent}>☀</Text></>}
        subtitle="Un nuevo día para acompañar, enseñar e inspirar."
        leading={
          <Pressable onPress={() => router.navigate('/perfil')} accessibilityRole="link" accessibilityLabel="Ver perfil">
            <AvatarAureola initials={iniciales(app.name)} uri={app.foto} size={desktop ? 60 : 52} />
          </Pressable>
        }
      />

      <View style={[s.hero, { minHeight: desktop ? 216 : 240 }]}>
        <Image source={classroom} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={desktop ? 'center' : { left: '62%', top: '50%' }} accessibilityLabel="Facilitadora acompañando a estudiantes en el aula" />
        <LinearGradient
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          colors={desktop ? [tint, alpha(tint, 0.97), alpha(tint, 0.75), alpha(tint, 0)] : [tint, alpha(tint, 0.94), alpha(tint, colors.scheme === 'dark' ? 0.6 : 0.3)]}
          locations={desktop ? [0, 0.24, 0.45, 0.74] : [0, colors.scheme === 'dark' ? 0.45 : 0.3, 0.8]}
        />
        {/* En el flujo (no absoluto): el alto crece si la frase del día es larga. */}
        <View style={desktop ? { marginLeft: 27, marginVertical: 25, maxWidth: 340 } : { marginLeft: 20, marginVertical: 22, maxWidth: 240 }}>
          <View style={s.eyebrow}>
            <Dot color={colors.success} />
            <Text weight="extrabold" size={10} color={colors.success} style={{ letterSpacing: 1.2, flexShrink: 1 }}>
              TU VOCACIÓN HACE LA DIFERENCIA
            </Text>
          </View>
          {/* Frase del día: aleatoria, sin repetir hasta mostrar todas (frase-del-dia.ts). */}
          <Text weight="bold" size={desktop ? 20 : 17} style={{ lineHeight: desktop ? 28 : 24 }} accessibilityLabel={`Frase del día: ${frase}`}>
            “{frase}”
          </Text>
          <Text size={desktop ? 12 : 11} color={colors.mutedForeground} style={{ lineHeight: 20, marginTop: 9, marginBottom: 16, maxWidth: desktop ? 265 : 200 }}>
            {sinFacilitador ? 'Completá o revisá tu postulación para sumarte como facilitador/a.' : 'Todo listo para tus clases de hoy. Sigamos construyendo el futuro, juntos.'}
          </Text>
          {sinFacilitador ? (
            <Button size="sm" label="Ir a Mi postulación" iconRight={ArrowRight} onPress={() => router.navigate('/postulacion')} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Button size="sm" label="Ver mi agenda" iconRight={ArrowRight} onPress={() => router.navigate('/horarios')} style={{ alignSelf: 'flex-start' }} />
          )}
        </View>
      </View>

      {/* Postulación sin terminar o con datos/archivos faltantes: solo aparece si falta algo. */}
      <AvisoPostulacionInicio onCompletar={() => router.navigate('/postulacion')} />

      {/* Cumpleaños del día: solo aparece si alguien cumple hoy. */}
      <Cumpleanios />

      {/* Intervenciones por semana (Total / Sí / No por día), encima de los KPIs. */}
      {!sinFacilitador && <GraficoSemanal />}

      {!sinFacilitador && (
      <View style={[s.stats, { gap: desktop ? (wide ? 16 : 10) : 12 }]}>
        {stats.map((st) => (
          <Card key={st.label} style={[s.stat, { flexBasis: desktop ? '22%' : '45%' }]}>
            <View style={s.statTop}>
              <Text size={11} color={colors.mutedForeground} style={{ flexShrink: 1 }}>
                {st.label}
              </Text>
              <StatIcon icon={st.icon} tone={st.tone} />
            </View>
            <Text weight="bold" size={27} style={{ marginTop: 7 }}>
              {st.value}
            </Text>
            <Text size={10} color={colors.mutedForeground} style={{ marginTop: 5 }}>
              {st.note}
            </Text>
          </Card>
        ))}
      </View>
      )}

      {!sinFacilitador && (
      <View style={[s.columns, desktop && { flexDirection: 'row', gap: wide ? 28 : 20 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SectionHeading title={<><Text weight="bold" size={16}>Tus clases de hoy</Text>{agenda.tipo === 'listo' && <Badge label={`${clasesHoy.length} ${clasesHoy.length === 1 ? 'clase' : 'clases'}`} />}</>}>
            <Button variant="link" size="sm" label="Ver todas" iconRight={ArrowUpRight} onPress={() => router.navigate('/horarios')} />
          </SectionHeading>
          {agenda.tipo === 'cargando' && <Estado texto="Cargando tus clases…" cargando />}
          {agenda.tipo === 'sin-facilitador' && <Estado texto="Tu usuario no está registrado como facilitador." />}
          {agenda.tipo === 'error' && <Estado texto={/not found/i.test(agenda.mensaje) ? 'Falta publicar en el backend el endpoint mi-agenda.' : agenda.mensaje} error />}
          {agenda.tipo === 'listo' && !clasesHoy.length && <Estado texto="No tenés clases programadas para hoy." />}
          {clasesHoy.map((c) => (
            <ClaseCard key={c.idPostulacion} clase={c} horario={c.horario} esHoy />
          ))}

          <View style={{ marginTop: 26 }}>
            <SectionHeading title="Actividad reciente">
              <Text size={10} color={colors.mutedForeground}>
                Últimas marcaciones
              </Text>
            </SectionHeading>
            {recientes.tipo === 'cargando' && <Estado texto="Cargando…" cargando />}
            {recientes.tipo === 'sin-facilitador' && <Estado texto="Tu usuario no está registrado como facilitador." />}
            {recientes.tipo === 'error' && <Estado texto={/not found/i.test(recientes.mensaje) ? 'Falta publicar en el backend mis-intervenciones/recientes.' : recientes.mensaje} error />}
            {recientes.tipo === 'listo' && !recientes.datos.length && <Estado texto="Todavía no registraste intervenciones." />}
            {recientes.tipo === 'listo' &&
              recientes.datos.map((r) => (
                <ActivityRow
                  key={r.id}
                  icon={r.siNo === 'Si' ? Check : CircleSlash}
                  tone={r.siNo === 'Si' ? 'success' : 'accent'}
                  title={`${r.siNo === 'Si' ? 'Clase desarrollada' : `No desarrollada${r.motivo ? ` · ${r.motivo}` : ''}`}${r.manual ? ` · ${r.manual}` : ''}`}
                  detail={[r.institucion, r.grado && `${r.grado} grado`, r.indice].filter(Boolean).join(' · ')}
                  time={cuando(r.fecha)}
                />
              ))}
          </View>
        </View>

        {desktop && (
          <View style={{ width: wide ? 295 : 260 }}>
            <SectionHeading title="Mi calendario">
              <CalendarDays size={16} color={colors.mutedForeground} />
            </SectionHeading>
            <MiniCalendar />
            <View style={{ marginTop: 24 }}>
              <SectionHeading title="Accesos rápidos" />
              <QuickLink href="/materiales" icon={FileText} tone="primary" title="Mis manuales e índices" detail="Tu trabajo, en un solo lugar" />
              <QuickLink href="/horarios" icon={CalendarDays} tone="success" title="Organizar mis horarios" detail="Planificá tu próxima semana" />
              <QuickLink href="/perfil" icon={GraduationCap} tone="accent" title="Mis instituciones" detail="Donde dejás tu huella" />
            </View>
            <View style={s.quote}>
              <BookOpen size={18} color={colors.primaryText} style={{ marginBottom: 12 }} />
              <Text weight="medium" size={12} style={{ lineHeight: 22 }}>
                “La educación no cambia el mundo, cambia a las personas que van a cambiar el mundo.”
              </Text>
              <Text size={10} color={colors.mutedForeground} style={{ marginTop: 8 }}>
                — Paulo Freire
              </Text>
            </View>
          </View>
        )}
      </View>
      )}
    </>
  );
}

type DelFacilitador<T> = { tipo: 'cargando' } | { tipo: 'sin-facilitador' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; datos: T };

/** Carga datos del facilitador logueado solo cuando hay ID_FACILITADOR (aislamiento entre facilitadores). */
function useDelFacilitador<T>(cargar: () => Promise<T>): DelFacilitador<T> {
  const { facilitador } = useSession();
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [r, setR] = useState<({ id: number } & DelFacilitador<T>) | null>(null);
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargar()
      .then((datos) => vigente && setR({ id, tipo: 'listo', datos }))
      .catch((e: unknown) => vigente && setR({ id, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No disponible' }));
    return () => {
      vigente = false;
    };
  }, [id, cargar]);
  if (facilitador.estado === 'listo' && facilitador.id === null) return { tipo: 'sin-facilitador' };
  if (facilitador.estado === 'error') return { tipo: 'error', mensaje: facilitador.mensaje };
  return r && r.id === id ? r : { tipo: 'cargando' };
}

/** "Hoy 08:30", "Ayer 14:20" o "13 oct.". */
function cuando(fecha: Date | null) {
  if (!fecha) return '';
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  if (mismoDia(fecha, hoy())) return `Hoy ${hora}`;
  if (mismoDia(fecha, sumarDias(hoy(), -1))) return `Ayer ${hora}`;
  return diaMesAbreviado(fecha);
}

function Estado({ texto, cargando, error }: { texto: string; cargando?: boolean; error?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 }}>
      {cargando && <ActivityIndicator size="small" color={colors.mutedForeground} />}
      <Text size={12} color={error ? colors.destructive : colors.mutedForeground} accessibilityRole={error ? 'alert' : undefined} style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}

/** Valor y nota de un KPI que sale de mis-intervenciones/resumen, con sus estados. */
function kpiDe(r: DelFacilitador<Resumen>, listo: (d: Resumen) => { value: string; note: ReactNode }): { value: string; note: ReactNode } {
  if (r.tipo === 'listo') return listo(r.datos);
  if (r.tipo === 'cargando') return { value: '…', note: 'Cargando…' };
  if (r.tipo === 'sin-facilitador') return { value: '—', note: 'Sin registro de facilitador' };
  return { value: '—', note: /not found/i.test(r.mensaje) ? 'Falta publicar mis-intervenciones' : 'No disponible' };
}

function Em({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text weight="semibold" size={10} color={colors.success}>
      {children}
    </Text>
  );
}

function ActivityRow({ icon, tone, title, detail, time }: { icon: LucideIcon; tone: Tone; title: string; detail: string; time: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.listRow}>
      <StatIcon icon={icon} tone={tone} />
      <View style={{ flex: 1 }}>
        <Text size={11}>{title}</Text>
        <Text size={10} color={colors.mutedForeground} style={{ marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      <Text size={10} color={colors.mutedForeground}>
        {time}
      </Text>
    </View>
  );
}

function QuickLink({ href, icon, tone, title, detail }: { href: Href; icon: LucideIcon; tone: Tone; title: string; detail: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.navigate(href)} style={({ pressed }) => [s.listRow, { paddingVertical: 13 }, pressed && { opacity: 0.7 }]}>
      <StatIcon icon={icon} tone={tone} size={36} />
      <View style={{ flex: 1 }}>
        <Text weight="bold" size={11}>
          {title}
        </Text>
        <Text size={10} color={colors.mutedForeground} style={{ marginTop: 4 }}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={15} color={colors.mutedForeground} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    hero: { position: 'relative', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: c.secondary, marginBottom: 24 },
    eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
    stats: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 30 },
    stat: { flexGrow: 1, padding: 16 },
    statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    columns: { flexDirection: 'column' },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    quote: { marginTop: 24, borderLeftWidth: 2, borderLeftColor: c.primary, paddingLeft: 16, paddingVertical: 4 },
  }),
);
