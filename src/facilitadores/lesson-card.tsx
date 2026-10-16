import { StyleSheet, View } from 'react-native';
import { Building2, Check, Clock3, MapPin } from 'lucide-react-native';

import { lessons } from './data';
import { useApp } from './provider';
import { colors, radius } from './theme';
import { Badge, Button, Card, Text } from './ui';

export function LessonCard({ index = 0 }: { index?: number }) {
  const lesson = lessons[index];
  const app = useApp();
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
        {marked ? <Badge tone="teal" icon={Check} label="Entrada registrada" /> : <Badge label={lesson.status} />}
      </View>
      <Text weight="bold" size={14} style={{ marginBottom: 8 }}>
        {lesson.title}
      </Text>
      <SchoolLine label={lesson.school} />
      <View style={s.footer}>
        <View style={s.grade}>
          <Text size={10} color={colors.mutedForeground}>
            {lesson.grade} · Presencial
          </Text>
        </View>
        {next ? (
          <Button size="sm" variant={app.marked ? 'secondary' : 'default'} icon={app.marked ? Check : MapPin} label={app.marked ? 'Ver marcación' : 'Marcar entrada'} onPress={() => app.setMarkOpen(true)} />
        ) : (
          <View style={s.row}>
            <MapPin size={12} color={colors.teal} />
            <Text size={10} color={colors.teal}>
              En institución
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export function SchoolLine({ label, size = 13 }: { label: string; size?: number }) {
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
  return (
    <View style={s.grade}>
      <Text size={10} color={colors.mutedForeground}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginBottom: 12, overflow: 'hidden' },
  next: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8, flexWrap: 'wrap' },
  grade: { backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm },
});
