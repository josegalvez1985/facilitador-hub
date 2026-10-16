import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CalendarDays, Plus } from 'lucide-react-native';

import { demoToday, grades, lessons, weekDays } from '../data';
import { Grade, LessonCard, SchoolLine } from '../lesson-card';
import { colors, radius } from '../theme';
import { Badge, Button, Card, Field, Modal, ModalActions, ModalText, PageTitle, SectionHeading, Text } from '../ui';

type ExtraLesson = { title: string; grade: string; time: string };

export function ScheduleScreen() {
  const [day, setDay] = useState(demoToday.day);
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<ExtraLesson[]>([]);
  const current = weekDays.find((d) => d.date === day);
  const hasClasses = day < 17;

  return (
    <>
      <PageTitle title="Mis horarios" subtitle="Tu semana, organizada para enseñar.">
        <Button size="sm" icon={Plus} label="Añadir clase" onPress={() => setOpen(true)} />
      </PageTitle>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days} style={{ marginBottom: 25, flexGrow: 0 }}>
        {weekDays.map((d) => {
          const active = day === d.date;
          return (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={`${d.long} ${d.date}`}
              accessibilityState={{ selected: active }}
              onPress={() => setDay(d.date)}
              style={[s.day, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
            >
              <Text size={9} weight="semibold" color={active ? colors.primaryForeground : colors.mutedForeground}>
                {d.short}
              </Text>
              <Text weight="bold" color={active ? colors.primaryForeground : colors.foreground}>
                {d.date}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeading title={`${current?.long ?? ''}, ${day} de octubre`}>
        <Text size={12} color={colors.mutedForeground}>
          {hasClasses ? `${lessons.length} clases` : 'Sin clases'}
        </Text>
      </SectionHeading>

      {hasClasses ? (
        lessons.map((_, i) => <LessonCard key={i} index={i} />)
      ) : (
        <View style={s.empty}>
          <CalendarDays size={24} color={colors.mutedForeground} />
          <Text color={colors.mutedForeground}>No hay clases programadas para este día.</Text>
        </View>
      )}

      {extra.map((l, i) => (
        <Card key={i} style={{ marginBottom: 12 }}>
          <Badge tone="teal" label="Nueva clase · Demostración" style={{ marginBottom: 12 }} />
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

function AddLessonModal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (l: ExtraLesson) => void }) {
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

const s = StyleSheet.create({
  days: { gap: 9 },
  day: { alignItems: 'center', justifyContent: 'center', gap: 3, height: 56, minWidth: 48, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  empty: { paddingVertical: 56, alignItems: 'center', gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
});
