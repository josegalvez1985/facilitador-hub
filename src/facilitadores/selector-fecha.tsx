// Campo de fecha que se ELIGE en un calendario (no se tipea). React Native puro, sin módulo
// nativo: anda igual en el APK, la PWA y la web. Las fechas fuera de [minimo, maximo] no se
// pueden tocar. Valor y límites como 'YYYY-MM-DD' (fecha local del dispositivo, ver fechas.ts).

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { fechaLarga, hoy, mismoDia, nombreMes, sumarDias } from './fechas';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Button, Modal, Text } from './ui';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const dos = (x: number) => String(x).padStart(2, '0');
const aIso = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
function deIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

type Props = {
  /** 'YYYY-MM-DD' o '' (sin elegir). */
  valor: string;
  onCambiar: (iso: string) => void;
  /** Etiqueta para lectores de pantalla y título del calendario. */
  titulo: string;
  minimo?: string;
  maximo?: string;
  error?: boolean;
  disabled?: boolean;
};

export function SelectorFecha({ valor, onCambiar, titulo, minimo, maximo, error, disabled }: Props) {
  const { colors } = useTheme();
  const s = useStyles();
  const [abierto, setAbierto] = useState(false);
  const elegida = deIso(valor);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titulo}: ${elegida ? fechaLarga(elegida) : 'sin elegir'}. Tocá para cambiarla`}
        disabled={disabled}
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [s.campo, error && { borderColor: colors.destructive }, pressed && { opacity: 0.75 }, disabled && { opacity: 0.5 }]}
      >
        <CalendarDays size={18} color={colors.primaryText} />
        <Text size={15} weight={elegida ? 'semibold' : 'regular'} color={elegida ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }}>
          {elegida ? fechaLarga(elegida) : 'Elegí la fecha'}
        </Text>
        <Text size={12} weight="semibold" color={colors.primaryText}>
          Cambiar
        </Text>
      </Pressable>

      <Modal visible={abierto} onClose={() => setAbierto(false)} title={titulo}>
        {abierto && (
          <Calendario
            inicial={elegida}
            minimo={minimo ? deIso(minimo) : null}
            maximo={maximo ? deIso(maximo) : null}
            onElegir={(d) => {
              onCambiar(aIso(d));
              setAbierto(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function Calendario({ inicial, minimo, maximo, onElegir }: { inicial: Date | null; minimo: Date | null; maximo: Date | null; onElegir: (d: Date) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [hoyFijo] = useState(hoy);
  const base = inicial ?? maximo ?? hoyFijo;
  const [vista, setVista] = useState({ anio: base.getFullYear(), mes: base.getMonth() });

  const primero = new Date(vista.anio, vista.mes, 1);
  const offset = (primero.getDay() + 6) % 7; // lunes primero
  const dias = new Date(vista.anio, vista.mes + 1, 0).getDate();
  const celdas = [...Array.from({ length: offset }, () => 0), ...Array.from({ length: dias }, (_, i) => i + 1)];

  const fuera = (d: Date) => (minimo !== null && d < minimo) || (maximo !== null && d > maximo);
  // Se puede ir a un mes si tiene al menos un día elegible.
  const puedeIr = (delta: number) => {
    const desde = new Date(vista.anio, vista.mes + delta, 1);
    const hasta = new Date(vista.anio, vista.mes + delta + 1, 0);
    return !((minimo !== null && hasta < minimo) || (maximo !== null && desde > maximo));
  };
  const mover = (delta: number) => {
    const d = new Date(vista.anio, vista.mes + delta, 1);
    setVista({ anio: d.getFullYear(), mes: d.getMonth() });
  };
  const atajos = [
    { label: 'Hoy', fecha: hoyFijo },
    { label: 'Ayer', fecha: sumarDias(hoyFijo, -1) },
  ].filter((a) => !fuera(new Date(a.fecha.getFullYear(), a.fecha.getMonth(), a.fecha.getDate())));

  return (
    <View style={{ gap: 12 }}>
      <View style={s.cabecera}>
        <Button size="icon" variant="outline" icon={ChevronLeft} accessibilityLabel="Mes anterior" disabled={!puedeIr(-1)} onPress={() => mover(-1)} />
        <Text weight="bold" size={15} accessibilityRole="header">
          {nombreMes(vista.mes)} {vista.anio}
        </Text>
        <Button size="icon" variant="outline" icon={ChevronRight} accessibilityLabel="Mes siguiente" disabled={!puedeIr(1)} onPress={() => mover(1)} />
      </View>

      <View style={s.grilla}>
        {DIAS_SEMANA.map((d, i) => (
          <View key={`d${i}`} style={s.celda}>
            <Text size={11} weight="semibold" color={colors.mutedForeground}>
              {d}
            </Text>
          </View>
        ))}
        {celdas.map((dia, i) => {
          if (dia === 0) return <View key={`v${i}`} style={s.celda} />;
          const fecha = new Date(vista.anio, vista.mes, dia);
          const bloqueado = fuera(fecha);
          const sel = inicial !== null && mismoDia(fecha, inicial);
          const esHoy = mismoDia(fecha, hoyFijo);
          return (
            <View key={dia} style={s.celda}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${fechaLarga(fecha)}${esHoy ? ', hoy' : ''}`}
                accessibilityState={{ selected: sel, disabled: bloqueado }}
                disabled={bloqueado}
                onPress={() => onElegir(fecha)}
                style={[s.dia, esHoy && !sel && { borderWidth: 1.5, borderColor: colors.primary }, sel && { backgroundColor: colors.primary }, bloqueado && { opacity: 0.3 }]}
              >
                <Text size={14} weight={sel || esHoy ? 'bold' : 'regular'} color={sel ? colors.primaryForeground : esHoy ? colors.primaryText : colors.foreground}>
                  {dia}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {atajos.length > 0 && (
        <View style={s.atajos}>
          {atajos.map((a) => (
            <Button key={a.label} variant="outline" size="sm" label={a.label} onPress={() => onElegir(a.fecha)} />
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    campo: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.card },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    grilla: { flexDirection: 'row', flexWrap: 'wrap' },
    celda: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
    dia: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    atajos: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  }),
);
