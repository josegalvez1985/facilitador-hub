import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { ArrowRight, ArrowUpRight, BookOpen, Building2, CalendarDays, Check, CheckCheck, ChevronRight, FileText, GraduationCap, type LucideIcon } from 'lucide-react-native';

import { demoToday, lessons } from '../data';
import { LessonCard } from '../lesson-card';
import { MiniCalendar } from '../mini-calendar';
import { useApp } from '../provider';
import { useLayout } from '../shell';
import { colors, radius, shadow, type Tone } from '../theme';
import { Badge, Button, Card, Dot, PageTitle, SectionHeading, StatIcon, Text } from '../ui';

const classroom = require('../../../assets/images/classroom.jpg');

export function HomeScreen() {
  const app = useApp();
  const router = useRouter();
  const { desktop, wide } = useLayout();

  const stats: { label: string; value: string; note: ReactNode; icon: LucideIcon; tone: Tone }[] = [
    { label: 'Clases esta semana', value: '12', note: <><Em>{lessons.length} clases</Em> para hoy</>, icon: CalendarDays, tone: 'primary' },
    { label: 'Marcaciones del mes', value: app.marked ? '25' : '24', note: <><Em>100 %</Em> de puntualidad</>, icon: CheckCheck, tone: 'teal' },
    { label: 'Materiales desarrollados', value: '8', note: <><Em>2 nuevos</Em> este mes</>, icon: BookOpen, tone: 'amber' },
    { label: 'Instituciones', value: '2', note: 'Conectando con la educación', icon: Building2, tone: 'primary' },
  ];

  return (
    <>
      <PageTitle title={<>¡Buen día, {app.name.split(' ')[0]}! <Text size={27} color={colors.amber}>☀</Text></>} subtitle="Un nuevo día para acompañar, enseñar e inspirar.">
        {desktop && (
          <View style={s.datePill}>
            <CalendarDays size={15} color={colors.foreground} />
            <Text size={12}>{demoToday.short}</Text>
          </View>
        )}
      </PageTitle>

      <View style={[s.hero, { height: desktop ? 216 : 240 }]}>
        <Image source={classroom} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={desktop ? 'center' : { left: '62%', top: '50%' }} accessibilityLabel="Facilitadora acompañando a estudiantes en el aula" />
        <LinearGradient
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          colors={desktop ? [colors.heroTint, 'rgba(221,240,250,0.97)', 'rgba(221,240,250,0.75)', 'rgba(221,240,250,0)'] : [colors.heroTint, 'rgba(221,240,250,0.94)', 'rgba(221,240,250,0.3)']}
          locations={desktop ? [0, 0.24, 0.45, 0.74] : [0, 0.3, 0.8]}
        />
        <View style={[s.heroCopy, desktop ? { left: 27, top: 25, maxWidth: 340 } : { left: 20, top: 22, maxWidth: 240 }]}>
          <View style={s.eyebrow}>
            <Dot color={colors.teal} />
            <Text weight="extrabold" size={10} color={colors.teal} style={{ letterSpacing: 1.2 }}>
              TU VOCACIÓN HACE LA DIFERENCIA
            </Text>
          </View>
          <Text weight="bold" size={desktop ? 25 : 20} style={{ lineHeight: desktop ? 35 : 28 }}>
            Pequeñas enseñanzas.{'\n'}Grandes oportunidades.
          </Text>
          <Text size={desktop ? 12 : 11} color={colors.mutedForeground} style={{ lineHeight: 20, marginTop: 9, marginBottom: 16, maxWidth: desktop ? 265 : 200 }}>
            Todo listo para tus clases de hoy. Sigamos construyendo el futuro, juntos.
          </Text>
          <Button size="sm" label="Ver mi agenda" iconRight={ArrowRight} onPress={() => router.navigate('/horarios')} style={{ alignSelf: 'flex-start' }} />
        </View>
      </View>

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

      <View style={[s.columns, desktop && { flexDirection: 'row', gap: wide ? 28 : 20 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SectionHeading title={<><Text weight="bold" size={16}>Tus clases de hoy</Text><Badge label={`${lessons.length} clases`} /></>}>
            <Button variant="link" size="sm" label="Ver todas" iconRight={ArrowUpRight} onPress={() => router.navigate('/horarios')} />
          </SectionHeading>
          {lessons.map((_, i) => (
            <LessonCard index={i} key={i} />
          ))}

          <View style={{ marginTop: 26 }}>
            <SectionHeading title="Actividad reciente">
              <Text size={10} color={colors.mutedForeground}>
                Esta semana
              </Text>
            </SectionHeading>
            <ActivityRow icon={Check} tone="teal" title={app.marked ? 'Entrada registrada · Matemática' : 'Clase finalizada · Matemática'} detail="Escuela Básica San José · 5.º grado" time={app.marked ? 'Ahora' : 'Ayer'} />
            <ActivityRow icon={FileText} tone="primary" title="Manual de fracciones actualizado" detail="Matemática · 5.º grado" time="13 oct." />
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
              <QuickLink href="/horarios" icon={CalendarDays} tone="teal" title="Organizar mis horarios" detail="Planificá tu próxima semana" />
              <QuickLink href="/perfil" icon={GraduationCap} tone="amber" title="Mis instituciones" detail="Donde dejás tu huella" />
            </View>
            <View style={s.quote}>
              <BookOpen size={18} color={colors.primary} style={{ marginBottom: 12 }} />
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
    </>
  );
}

function Em({ children }: { children: ReactNode }) {
  return (
    <Text weight="semibold" size={10} color={colors.teal}>
      {children}
    </Text>
  );
}

function ActivityRow({ icon, tone, title, detail, time }: { icon: LucideIcon; tone: Tone; title: string; detail: string; time: string }) {
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

const s = StyleSheet.create({
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  hero: { position: 'relative', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.secondary, marginBottom: 24 },
  heroCopy: { position: 'absolute' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 30 },
  stat: { flexGrow: 1, padding: 16, ...shadow },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  columns: { flexDirection: 'column' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  quote: { marginTop: 24, borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 16, paddingVertical: 4 },
});
