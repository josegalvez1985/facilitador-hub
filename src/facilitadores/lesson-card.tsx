import { StyleSheet, View } from 'react-native';
import { Building2, Check, Clock3, MapPin } from 'lucide-react-native';

import { lessons } from './data';
import { useApp } from './provider';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Badge, Button, Card, Text } from './ui';

export function LessonCard({ index = 0 }: { index?: number }) {
  const lesson = lessons[index];
  const app = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  if (!lesson) return null;
  const next = index === 0;
  const marked = next && app.marked;
  return (
    <Card style={[s.card, next && s.next]}>
      <View style={s.top}>
        <View style={s.row}>
          <Clock3 size={13} color={colors.foreground} />
          <Text weight="semibold" size={11}>
            {lesson.time}
          </Text>
        </View>
        {marked ? <Badge tone="success" icon={Check} label="Entrada registrada" /> : <Badge label={lesson.status} />}
      </View>
      <Text weight="bold" size={14} style={{ marginBottom: 8 }}>
        {lesson.title}
      </Text>
      <SchoolLine label={lesson.school} />
      <View style={s.footer}>
        <Grade label={`${lesson.grade} · Presencial`} />
        {next ? (
          <Button size="sm" variant={app.marked ? 'secondary' : 'default'} icon={app.marked ? Check : MapPin} label={app.marked ? 'Ver marcación' : 'Marcar entrada'} onPress={() => app.setMarkOpen(true)} />
        ) : (
          <View style={s.row}>
            <MapPin size={12} color={colors.success} />
            <Text size={10} color={colors.success}>
              En institución
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export function SchoolLine({ label, size = 13 }: { label: string; size?: number }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={[s.row, { gap: 6 }]}>
      <Building2 size={size} color={colors.mutedForeground} />
      <Text size={11} color={colors.mutedForeground} style={{ lineHeight: 18, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function Grade({ label }: { label: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.grade}>
      <Text size={10} color={colors.mutedForeground}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { marginBottom: 12, overflow: 'hidden' },
    next: { borderLeftWidth: 3, borderLeftColor: c.primary },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8, flexWrap: 'wrap' },
    grade: { backgroundColor: c.muted, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm },
  }),
);
