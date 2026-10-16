// "Mis horarios" = página 3 "Agenda" de APEX 193573 (ver src/facilitadores/agenda.ts).
// Dos vistas sobre los mismos datos:
// - Por día: la semana actual (hoy seleccionado) con las clases de cada día.
// - Semana completa: todas las filas del reporte APEX, en su mismo orden.

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CalendarDays, Plus, RefreshCw } from 'lucide-react-native';

import { cargarAgenda, clasesDelDia, diaAgenda, type Agenda } from '../agenda';
import { useSession } from '../auth/session';
import { ClaseCard } from '../clase-agenda';
import { grades } from '../data';
import { diaYMes, hoy, semanaDe } from '../fechas';
import { Grade, SchoolLine } from '../lesson-card';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { Badge, Button, Card, Field, Modal, ModalActions, ModalText, PageTitle, SectionHeading, Text } from '../ui';

type ExtraLesson = { title: string; grade: string; time: string };
type Estado = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; agenda: Agenda };
type Resultado = { clave: string } & Exclude<Estado, { tipo: 'cargando' }>;


export function ScheduleScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const { facilitador, reintentarFacilitador } = useSession();

  // Semana ACTUAL (lunes a domingo), con hoy seleccionado.
  const [semana] = useState(() => semanaDe(hoy()));
  const [day, setDay] = useState(() => semana.find((d) => d.esHoy)?.clave ?? semana[0]?.clave ?? '');
  const [vista, setVista] = useState<'dia' | 'semana'>('dia');
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<ExtraLesson[]>([]);
  const current = semana.find((d) => d.clave === day) ?? semana[0];

  // Sin ID_FACILITADOR no se piden datos (aislamiento entre facilitadores).
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const clave = `${id}-${intento}`;
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarAgenda()
      .then((agenda) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'listo', agenda }))
      .catch((e: unknown) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar la agenda' }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);
  const estado: Estado = resultado && resultado.clave === clave ? resultado : { tipo: 'cargando' };
  const recargar = () => (facilitador.estado === 'error' ? reintentarFacilitador() : setIntento((n) => n + 1));

  const clases = estado.tipo === 'listo' ? estado.agenda.clases : [];
  const delDia = current ? clasesDelDia(clases, diaAgenda(current.fecha)) : [];
  const cuantas = (fecha: Date) => clasesDelDia(clases, diaAgenda(fecha)).length;

  let contenido: ReactNode;
  if (facilitador.estado === 'listo' && facilitador.id === null) {
    contenido = <Vacio texto="Tu usuario no está registrado como facilitador." />;
  } else if (facilitador.estado === 'error' || estado.tipo === 'error') {
    const mensaje = facilitador.estado === 'error' ? facilitador.mensaje : estado.tipo === 'error' ? estado.mensaje : '';
    contenido = (
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
          {/not found/i.test(mensaje) ? 'Falta publicar en el backend el endpoint mi-agenda (sql/agenda_app_ethos.sql).' : mensaje}
        </Text>
        <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={recargar} />
      </Card>
    );
  } else if (facilitador.estado === 'cargando' || estado.tipo === 'cargando') {
    contenido = (
      <View style={s.empty}>
        <ActivityIndicator color={colors.primaryText} />
        <Text color={colors.mutedForeground}>Cargando tu agenda…</Text>
      </View>
    );
  } else if (!clases.length) {
    contenido = <Vacio texto="No se ha encontrado ningún dato" />;
  } else if (vista === 'semana') {
    contenido = (
      <>
        <SectionHeading title="Semana completa">
          <Text size={12} color={colors.mutedForeground}>
            {clases.length} {clases.length === 1 ? 'clase' : 'clases'}
          </Text>
        </SectionHeading>
        {clases.map((c) => (
          <ClaseCard key={c.idPostulacion} clase={c} />
        ))}
      </>
    );
  } else {
    contenido = (
      <>
        <SectionHeading title={current ? diaYMes(current.fecha) : ''}>
          <Text size={12} color={colors.mutedForeground}>
            {delDia.length ? `${delDia.length} ${delDia.length === 1 ? 'clase' : 'clases'}` : 'Sin clases'}
          </Text>
        </SectionHeading>
        {delDia.length ? (
          delDia.map((c) => <ClaseCard key={c.idPostulacion} clase={c} horario={c.horario} esHoy={!!current?.esHoy} />)
        ) : (
          <Vacio texto="No hay clases programadas para este día." />
        )}
      </>
    );
  }

  return (
    <>
      <PageTitle title="Mis horarios" subtitle="Tu semana, organizada para enseñar.">
        <Button size="sm" icon={Plus} label="Añadir clase" onPress={() => setOpen(true)} />
      </PageTitle>

      <View style={s.segmento} accessibilityRole="tablist">
        {(
          [
            ['dia', 'Por día'],
            ['semana', 'Semana completa'],
          ] as const
        ).map(([v, l]) => (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: vista === v }} onPress={() => setVista(v)} style={[s.segmentoOp, vista === v && s.segmentoActivo]}>
            <Text size={13} weight={vista === v ? 'bold' : 'medium'} color={vista === v ? colors.primaryText : colors.mutedForeground}>
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      {vista === 'dia' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days} style={{ marginBottom: 22, flexGrow: 0 }}>
          {semana.map((d) => {
            const active = day === d.clave;
            const n = cuantas(d.fecha);
            return (
              <Pressable
                key={d.clave}
                accessibilityRole="button"
                accessibilityLabel={`${d.largo} ${d.numero}${d.esHoy ? ', hoy' : ''}${n ? `, ${n} clases` : ''}`}
                accessibilityState={{ selected: active }}
                onPress={() => setDay(d.clave)}
                style={[s.day, d.esHoy && !active ? { borderColor: colors.primary, borderWidth: 2 } : null, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
              >
                <Text size={9} weight="semibold" color={active ? colors.primaryForeground : colors.mutedForeground}>
                  {d.esHoy ? 'HOY' : d.corto}
                </Text>
                <Text weight="bold" color={active ? colors.primaryForeground : colors.foreground}>
                  {d.numero}
                </Text>
                <View style={[s.contador, { opacity: n ? 1 : 0 }, active && { backgroundColor: colors.primaryForeground }]}>
                  <Text size={8} weight="bold" color={active ? colors.primary : colors.primaryForeground}>
                    {n}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {contenido}

      {extra.map((l, i) => (
        <Card key={i} style={{ marginBottom: 12 }}>
          <Badge tone="success" label="Nueva clase · Demostración" style={{ marginBottom: 12 }} />
          <Text weight="bold" style={{ marginBottom: 8 }}>
            {l.title}
          </Text>
          <SchoolLine label="Escuela Básica San José" />
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Grade label={`${l.grade} · ${l.time}`} />
          </View>
        </Card>
      ))}

      <AddLessonModal visible={open} onClose={() => setOpen(false)} onAdd={(l) => setExtra([...extra, l])} />
    </>
  );
}

function Vacio({ texto }: { texto: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.empty}>
      <CalendarDays size={24} color={colors.mutedForeground} />
      <Text color={colors.mutedForeground} style={{ textAlign: 'center' }}>
        {texto}
      </Text>
    </View>
  );
}

function AddLessonModal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (l: ExtraLesson) => void }) {
  const s = useStyles();
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState(grades[1] ?? '');
  const [time, setTime] = useState('08:00');
  const valid = title.trim().length > 0 && /^\d{2}:\d{2}$/.test(time);

  const submit = () => {
    if (!valid) return;
    onAdd({ title: title.trim(), grade, time });
    setTitle('');
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Añadir clase" closeLabel="Cancelar">
      <Field label="Nombre de la clase" value={title} onChangeText={setTitle} placeholder="Ej. Matemática · Geometría" onSubmitEditing={submit} autoFocus />
      <Text weight="semibold" size={12} style={{ marginBottom: 8 }}>
        Grado
      </Text>
      <View style={s.chips}>
        {grades.map((g) => (
          <Button key={g} size="sm" variant={grade === g ? 'default' : 'outline'} label={g} onPress={() => setGrade(g)} />
        ))}
      </View>
      <Field label="Horario" value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" maxLength={5} />
      <ModalText>Se añadirá a la agenda de demostración.</ModalText>
      <ModalActions>
        <Button variant="outline" label="Cancelar" onPress={onClose} />
        <Button label="Añadir clase" onPress={submit} disabled={!valid} />
      </ModalActions>
    </Modal>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    days: { gap: 9 },
    day: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      height: 66,
      minWidth: 48,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    contador: { minWidth: 16, height: 14, paddingHorizontal: 4, borderRadius: 7, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    empty: { paddingVertical: 56, alignItems: 'center', gap: 16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    segmento: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.muted, borderRadius: radius.lg, marginBottom: 16 },
    segmentoOp: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: radius.md },
    segmentoActivo: { backgroundColor: colors.card, ...colors.shadow },
  }),
);
