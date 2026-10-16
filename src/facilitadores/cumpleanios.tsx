// Cumpleaños del día en Inicio: GET cumpleanios-hoy (sql/facilitador_app_ethos.sql →
// PKG_FACILITADOR_APP_ETHOS.CUMPLEANIOS_HOY). El servidor devuelve SOLO el nombre de
// los facilitadores activos que cumplen hoy y si es el usuario logueado (soy_yo).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { authFetch, filasDe } from './auth/api';
import { useSession } from './auth/session';
import { iniciales } from './data';
import { useApp } from './provider';
import { alpha, radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Avatar, AvatarAureola, Text } from './ui';

export type Cumpleanero = { nombre: string; soyYo: boolean };

/** "MARIA ELENA GONZALEZ" → "María Elena Gonzalez" (los nombres suelen venir en mayúsculas). */
export function nombrePropio(t: string) {
  return t
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');
}

const primerNombre = (t: string) => t.split(' ')[0] ?? t;

export async function cargarCumpleanios(): Promise<Cumpleanero[]> {
  const r = await authFetch('cumpleanios-hoy');
  return filasDe(r)
    .map((f) => ({ nombre: nombrePropio(String(f.nombre ?? '')), soyYo: f.soy_yo === true }))
    .filter((c) => c.nombre);
}

/** "María", "María y Juan", "María, Juan y Ana", "María, Juan, Ana y 4 más". */
function enumerar(nombres: string[]) {
  if (nombres.length <= 1) return nombres.join('');
  if (nombres.length <= 3) return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más`;
}

/** Carga una vez por facilitador. Sin facilitador (o mientras resuelve) no pide nada. */
function useCumpleanios(): Cumpleanero[] {
  const { facilitador } = useSession();
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [r, setR] = useState<{ id: number; lista: Cumpleanero[] } | null>(null);
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarCumpleanios()
      .then((lista) => vigente && setR({ id, lista }))
      // Es un saludo, no un dato crítico: si falla, la tarjeta simplemente no aparece.
      .catch(() => vigente && setR({ id, lista: [] }));
    return () => {
      vigente = false;
    };
  }, [id]);
  return r && r.id === id ? r.lista : [];
}

/** Tarjetas de cumpleaños de Inicio. Si nadie cumple hoy no se muestra nada. */
export function Cumpleanios() {
  const lista = useCumpleanios();
  const yo = lista.find((c) => c.soyYo);
  const otros = lista.filter((c) => !c.soyYo);
  if (!lista.length) return null;
  return (
    <>
      {yo && <MiCumpleanios nombre={yo.nombre} />}
      {otros.length > 0 && <CumpleaniosDeOtros personas={otros} />}
    </>
  );
}

/** Confeti discreto con los colores del tema (decorativo). */
function Confeti() {
  const { colors } = useTheme();
  const piezas = [
    { top: 10, right: 18, w: 8, h: 8, r: 4, c: colors.primary, rot: '0deg' },
    { top: 22, right: 46, w: 10, h: 4, r: 2, c: colors.accent, rot: '35deg' },
    { top: 8, right: 78, w: 5, h: 5, r: 3, c: colors.success, rot: '0deg' },
    { top: 40, right: 26, w: 10, h: 4, r: 2, c: colors.success, rot: '-30deg' },
    { top: 52, right: 60, w: 6, h: 6, r: 3, c: colors.accent, rot: '0deg' },
    { top: 30, right: 104, w: 9, h: 3, r: 2, c: colors.primary, rot: '60deg' },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {piezas.map((p, i) => (
        <View key={i} style={{ position: 'absolute', top: p.top, right: p.right, width: p.w, height: p.h, borderRadius: p.r, backgroundColor: alpha(p.c, 0.55), transform: [{ rotate: p.rot }] }} />
      ))}
    </View>
  );
}

function MiCumpleanios({ nombre }: { nombre: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const app = useApp();
  return (
    <View style={s.tarjeta} accessibilityRole="summary" accessibilityLabel={`¡Feliz cumpleaños, ${primerNombre(nombre)}! Gracias por cada clase y cada semilla que sembrás. Hoy el aplauso es para vos.`}>
      <LinearGradient style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} colors={[colors.accentSoft, alpha(colors.primary, 0.12), colors.card]} />
      <Confeti />
      <View style={s.fila}>
        <AvatarAureola initials={iniciales(nombre)} uri={app.foto} size={48} />
        <View style={{ flex: 1 }}>
          <Text weight="extrabold" size={17} style={{ lineHeight: 23 }}>
            🎉 ¡Feliz cumpleaños, {primerNombre(nombre)}!
          </Text>
          <Text size={13} color={colors.mutedForeground} style={{ marginTop: 4, lineHeight: 19 }}>
            Gracias por cada clase y cada semilla que sembrás. Hoy el aplauso es para vos.
          </Text>
        </View>
      </View>
    </View>
  );
}

function CumpleaniosDeOtros({ personas }: { personas: Cumpleanero[] }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [abierto, setAbierto] = useState(false);
  const nombres = personas.map((p) => primerNombre(p.nombre));
  const quienes = enumerar(personas.length === 1 ? [personas[0]!.nombre] : nombres);
  const mensaje =
    personas.length === 1
      ? 'cumple años hoy. Su vocación inspira a tantos estudiantes: ¡hoy le toca recibir los saludos!'
      : personas.length <= 3
        ? 'están de cumpleaños. ¡Que la comunidad se llene de saludos!'
        : 'celebran hoy. ¡Feliz vuelta al sol para todos!';
  // Con varios, tocar la tarjeta muestra los nombres completos.
  const desplegable = personas.length > 1;

  return (
    <Pressable
      disabled={!desplegable}
      onPress={() => setAbierto(!abierto)}
      accessibilityRole={desplegable ? 'button' : 'summary'}
      accessibilityState={desplegable ? { expanded: abierto } : undefined}
      accessibilityLabel={`¡Hoy celebramos! ${quienes} ${mensaje}`}
      style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.9 }]}
    >
      <LinearGradient style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} colors={[colors.accentSoft, colors.card]} />
      <Confeti />
      <Text weight="extrabold" size={15} style={{ marginBottom: 10 }}>
        🎂 ¡Hoy celebramos!
      </Text>
      <View style={s.fila}>
        <View style={s.avatares}>
          {personas.slice(0, 3).map((p, i) => (
            <View key={p.nombre + i} style={[s.avatarBorde, i > 0 && { marginLeft: -12 }]}>
              <Avatar initials={iniciales(p.nombre)} size={36} />
            </View>
          ))}
        </View>
        <Text size={13} style={{ flex: 1, lineHeight: 19 }}>
          <Text size={13} weight="bold">
            {quienes}
          </Text>{' '}
          {mensaje}
        </Text>
        {desplegable && (abierto ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />)}
      </View>
      {abierto && (
        <View style={s.lista}>
          {personas.map((p, i) => (
            <View key={p.nombre + i} style={s.persona}>
              <Avatar initials={iniciales(p.nombre)} size={28} />
              <Text size={13} weight="semibold" style={{ flex: 1 }}>
                {p.nombre}
              </Text>
              <Text size={13}>🎈</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    tarjeta: { overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16, marginBottom: 16 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatares: { flexDirection: 'row' },
    avatarBorde: { borderRadius: 20, borderWidth: 2, borderColor: c.card },
    lista: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
    persona: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  }),
);
