import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { ArrowUpRight, BookOpen, Download, FileText, Share2 } from 'lucide-react-native';

import { materialIndex, materials, type Material } from '../data';
import { Grade, SchoolLine } from '../lesson-card';
import { useLayout } from '../shell';
import { colors, radius } from '../theme';
import { Badge, Button, Card, Modal, ModalActions, ModalText, PageTitle, StatIcon, Text } from '../ui';

const filters = ['Todos', 'Manuales', 'Índices'] as const;
type Filter = (typeof filters)[number];

function indexText(m: Material) {
  return `${m.title}\n${m.subject} - ${m.grade}\n\nÍndice de contenidos\n${materialIndex.join('\n')}\n\nMaterial de demostración.`;
}

// En web descarga un .txt; en iOS/Android abre la hoja de compartir del sistema.
async function exportIndex(m: Material) {
  const text = indexText(m);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${m.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: m.title, message: text });
}

export function MaterialsScreen() {
  const { desktop, wide } = useLayout();
  const [filter, setFilter] = useState<Filter>('Todos');
  const [selected, setSelected] = useState<Material | null>(null);
  const visible = materials.filter((m) => filter === 'Todos' || m.type === (filter === 'Manuales' ? 'Manual' : 'Índice'));
  const columns = wide ? 3 : desktop ? 2 : 1;

  return (
    <>
      <PageTitle title="Mis materiales" subtitle="Ideas que se convierten en aprendizaje.">
        {desktop && (
          <View style={s.pill}>
            <BookOpen size={15} color={colors.foreground} />
            <Text size={12}>{materials.length} materiales</Text>
          </View>
        )}
      </PageTitle>

      <View style={s.filters}>
        {filters.map((f) => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} label={f} onPress={() => setFilter(f)} />
        ))}
      </View>

      <View style={s.grid}>
        {visible.map((m) => (
          <Card key={m.title} style={[s.card, { width: columns === 1 ? '100%' : columns === 2 ? '48.5%' : '31.8%' }]}>
            <View style={s.row}>
              <StatIcon icon={FileText} size={36} />
              <Badge tone="teal" label="Desarrollado" />
            </View>
            <Text weight="bold" size={15} style={{ marginTop: 18, marginBottom: 10 }}>
              {m.title}
            </Text>
            <Text size={11} color={colors.mutedForeground}>
              {m.subject} · {m.grade}
            </Text>
            <View style={{ marginTop: 8 }}>
              <SchoolLine label="Escuela Básica San José" />
            </View>
            <View style={[s.row, { marginTop: 22 }]}>
              <Grade label={`${m.type} · ${m.pages} páginas`} />
              <Button variant="ghost" size="icon" icon={ArrowUpRight} accessibilityLabel={`Abrir ${m.title}`} onPress={() => setSelected(m)} />
            </View>
          </Card>
        ))}
      </View>

      <Modal visible={selected !== null} onClose={() => setSelected(null)} title={selected?.title ?? ''} closeLabel="Cerrar material">
        {selected && (
          <>
            <Badge label={`${selected.type} · ${selected.grade}`} style={{ marginBottom: 14 }} />
            <ModalText strong>Índice de contenidos</ModalText>
            <ModalText>{materialIndex.join('\n')}</ModalText>
            <ModalActions>
              <Button
                icon={Platform.OS === 'web' ? Download : Share2}
                label={Platform.OS === 'web' ? 'Descargar índice' : 'Compartir índice'}
                onPress={() => void exportIndex(selected)}
              />
            </ModalActions>
          </>
        )}
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  card: { padding: 22 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
