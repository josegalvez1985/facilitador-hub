import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { hoy, mismoDia, nombreMes } from './fechas';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Button, Card, Dot, Text } from './ui';

const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function MiniCalendar() {
  const { colors } = useTheme();
  const s = useStyles();
  // Arranca en el día y mes ACTUALES.
  const [hoyFijo] = useState(hoy);
  const [selected, setSelected] = useState(() => new Date(hoyFijo.getFullYear(), hoyFijo.getMonth(), hoyFijo.getDate()));
  const [vista, setVista] = useState(() => ({ anio: hoyFijo.getFullYear(), mes: hoyFijo.getMonth() }));
  const offset = (new Date(vista.anio, vista.mes, 1).getDay() + 6) % 7;
  const days = new Date(vista.anio, vista.mes + 1, 0).getDate();
  const name = nombreMes(vista.mes);
  const cells = [...Array.from({ length: offset }, () => 0), ...Array.from({ length: days }, (_, i) => i + 1)];
  const mover = (delta: number) => setVista((v) => {
    const d = new Date(v.anio, v.mes + delta, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  return (
    <Card style={{ padding: 20 }}>
      <View style={s.head}>
        <Text weight="bold" size={12}>
          {name} {vista.anio}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <Button size="icon" variant="ghost" icon={ChevronLeft} accessibilityLabel="Mes anterior" onPress={() => mover(-1)} style={s.arrow} />
          <Button size="icon" variant="ghost" icon={ChevronRight} accessibilityLabel="Mes siguiente" onPress={() => mover(1)} style={s.arrow} />
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
        {cells.map((day, i) => {
          if (day === 0) return <View key={i} style={s.slot} />;
          const fecha = new Date(vista.anio, vista.mes, day);
          const elegido = mismoDia(fecha, selected);
          const esHoy = mismoDia(fecha, hoyFijo);
          return (
            <View key={i} style={s.slot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar ${day} de ${name}${esHoy ? ', hoy' : ''}`}
                accessibilityState={{ selected: elegido }}
                onPress={() => setSelected(fecha)}
                style={[s.cell, esHoy && !elegido && { borderWidth: 1.5, borderColor: colors.primary }, elegido && { backgroundColor: colors.primary }]}
              >
                <Text size={10} weight={esHoy ? 'bold' : 'regular'} color={elegido ? colors.primaryForeground : esHoy ? colors.primaryText : colors.foreground}>
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={s.legend}>
        <Dot />
        <Text size={9} color={colors.mutedForeground}>
          {mismoDia(selected, hoyFijo) ? 'Hoy' : 'Día seleccionado'}: {selected.getDate()} de {nombreMes(selected.getMonth()).toLowerCase()}
          {selected.getFullYear() !== hoyFijo.getFullYear() ? ` de ${selected.getFullYear()}` : ''}
        </Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    arrow: { width: 26, height: 26 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
    slot: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 28 },
    cell: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, marginTop: 16 },
  }),
);
