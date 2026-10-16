// Perfil → Ayuda: el manual de uso (docs/manual-usuario.md → manual.ts, `npm run manual`)
// como una lista de capítulos desplegables. Interpreta el subconjunto de Markdown que usa
// el manual: "## " capítulo, "### " subtítulo, "- " viñeta, "1. " paso, "> " consejo y **negrita**.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react-native';

import { MANUAL } from './manual';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Text } from './ui';

type Bloque = { tipo: 'subtitulo' | 'parrafo' | 'vineta' | 'consejo'; texto: string } | { tipo: 'paso'; n: number; texto: string };
export type Capitulo = { titulo: string; bloques: Bloque[] };

export function capitulos(md: string): Capitulo[] {
  const lista: Capitulo[] = [];
  let actual: Capitulo | null = null;
  let parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length && actual) actual.bloques.push({ tipo: 'parrafo', texto: parrafo.join(' ') });
    parrafo = [];
  };
  for (const linea of md.split('\n')) {
    const l = linea.trim();
    if (l.startsWith('## ')) {
      cerrarParrafo();
      actual = { titulo: l.slice(3), bloques: [] };
      lista.push(actual);
      continue;
    }
    if (!actual) continue; // el título "# " del documento: el encabezado de la sección ya lo dice
    if (!l) {
      cerrarParrafo();
      continue;
    }
    const paso = /^(\d+)\.\s+(.*)$/.exec(l);
    let bloque: Bloque | null = null;
    if (l.startsWith('### ')) bloque = { tipo: 'subtitulo', texto: l.slice(4) };
    else if (l.startsWith('- ')) bloque = { tipo: 'vineta', texto: l.slice(2) };
    else if (l.startsWith('> ')) bloque = { tipo: 'consejo', texto: l.slice(2) };
    else if (paso) bloque = { tipo: 'paso', n: Number(paso[1]), texto: paso[2] ?? '' };
    if (bloque) {
      cerrarParrafo();
      actual.bloques.push(bloque);
    } else parrafo.push(l);
  }
  cerrarParrafo();
  return lista;
}

const CAPITULOS = capitulos(MANUAL);

/** Texto con **negrita**. `\*` en el .md es un asterisco literal. */
function Linea({ texto, size = 13, color }: { texto: string; size?: number; color?: string }) {
  const partes = texto.replace(/\\\*/g, '*').split(/(\*\*[^*]+\*\*)/);
  return (
    <Text size={size} color={color} style={{ lineHeight: Math.round(size * 1.55), flexShrink: 1 }}>
      {partes.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} size={size} weight="bold" color={color}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

function Contenido({ bloques }: { bloques: Bloque[] }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.contenido}>
      {bloques.map((b, i) => {
        if (b.tipo === 'subtitulo')
          return (
            <Text key={i} weight="bold" size={14} style={{ marginTop: i ? 8 : 0 }}>
              {b.texto}
            </Text>
          );
        if (b.tipo === 'vineta')
          return (
            <View key={i} style={s.item}>
              <Text size={13} color={colors.primaryText} style={{ lineHeight: 20 }}>
                •
              </Text>
              <Linea texto={b.texto} />
            </View>
          );
        if (b.tipo === 'paso')
          return (
            <View key={i} style={s.item}>
              <View style={s.nro}>
                <Text size={11} weight="bold" color={colors.primaryForeground}>
                  {b.n}
                </Text>
              </View>
              <Linea texto={b.texto} />
            </View>
          );
        if (b.tipo === 'consejo')
          return (
            <View key={i} style={s.consejo}>
              <Lightbulb size={15} color={colors.primaryText} style={{ marginTop: 2 }} />
              <Linea texto={b.texto} />
            </View>
          );
        return <Linea key={i} texto={b.texto} />;
      })}
    </View>
  );
}

/** Sección "Ayuda" de Perfil: un capítulo abierto a la vez. */
export function Ayuda() {
  const { colors } = useTheme();
  const s = useStyles();
  const [abierto, setAbierto] = useState<number | null>(null);
  return (
    <View style={{ marginTop: 38 }}>
      <View style={s.encabezado}>
        <BookOpen size={16} color={colors.foreground} />
        <Text weight="bold" size={16}>
          Ayuda
        </Text>
      </View>
      <Text size={12} color={colors.mutedForeground} style={{ marginBottom: 14 }}>
        Manual de uso de la app. Tocá un tema para verlo.
      </Text>
      <View style={s.lista}>
        {CAPITULOS.map((c, i) => {
          const activo = abierto === i;
          return (
            <View key={c.titulo} style={[s.capitulo, i > 0 && s.separador]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.titulo}
                accessibilityState={{ expanded: activo }}
                onPress={() => setAbierto(activo ? null : i)}
                style={({ pressed }) => [s.titulo, pressed && { backgroundColor: colors.muted }]}
              >
                <Text weight={activo ? 'bold' : 'semibold'} size={14} color={activo ? colors.primaryText : colors.foreground} style={{ flex: 1 }}>
                  {c.titulo}
                </Text>
                {activo ? <ChevronUp size={18} color={colors.primaryText} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
              </Pressable>
              {activo && <Contenido bloques={c.bloques} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    lista: { borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.card, overflow: 'hidden' },
    capitulo: {},
    separador: { borderTopWidth: 1, borderTopColor: c.border },
    titulo: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 16 },
    contenido: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    nro: { width: 20, height: 20, borderRadius: 10, marginTop: 1, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    consejo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: c.secondary },
  }),
);
