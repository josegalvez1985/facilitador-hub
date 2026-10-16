import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { demoToday, monthNames } from './data';
import { colors, radius } from './theme';
import { Button, Card, Dot, Text } from './ui';

const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function MiniCalendar() {
  const [selected, setSelected] = useState(demoToday.day);
  const [month, setMonth] = useState(demoToday.month);
  const offset = (new Date(demoToday.year, month, 1).getDay() + 6) % 7;
  const days = new Date(demoToday.year, month + 1, 0).getDate();
  const name = monthNames[month] ?? '';
  const cells = [...Array.from({ length: offset }, () => 0), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <Card style={{ padding: 20 }}>
      <View style={s.head}>
        <Text weight="bold" size={12}>
          {name} {demoToday.year}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <Button size="icon" variant="ghost" icon={ChevronLeft} accessibilityLabel="Mes anterior" onPress={() => setMonth((month + 11) % 12)} style={s.arrow} />
          <Button size="icon" variant="ghost" icon={ChevronRight} accessibilityLabel="Mes siguiente" onPress={() => setMonth((month + 1) % 12)} style={s.arrow} />
        </View>
      </View>
      <View style={s.grid}>
        {dayLabels.map((d, i) => (
          <View key={`l${i}`} style={s.slot}>
            <Text size={9} color={colors.mutedForeground}>
              {d}
            </Text>
          </View>
        ))}
        {cells.map((day, i) => (
          <View key={i} style={s.slot}>
            {day > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar ${day} de ${name}`}
                accessibilityState={{ selected: selected === day }}
                onPress={() => setSelected(day)}
                style={[s.cell, selected === day && { backgroundColor: colors.primary }]}
              >
                <Text size={10} color={selected === day ? colors.primaryForeground : colors.foreground}>
                  {day}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <View style={s.legend}>
        <Dot />
        <Text size={9} color={colors.mutedForeground}>
          Día seleccionado: {selected} de {name.toLowerCase()}
        </Text>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  arrow: { width: 26, height: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  slot: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 28 },
  cell: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 16 },
});
