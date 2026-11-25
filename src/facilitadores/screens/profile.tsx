import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Building2, Camera, Check, Lock, LogOut, MapPin, Moon, Palette, Smartphone, Sun, SunMoon, Trash2, type LucideIcon } from 'lucide-react-native';

import { cargarAgenda } from '../agenda';
import { useSession } from '../auth/session';
import { Ayuda } from '../ayuda';
import { iniciales } from '../data';
import { elegirFoto } from '../foto-perfil';
import { useApp } from '../provider';
import { useLayout, useRol } from '../shell';
import { useToast } from '../toast';
import { palettes, radius, themes } from '../theme';
import { makeStyles, useTheme, type AppearanceMode } from '../theme-provider';
import { Avatar, Button, Card, PageTitle, Text } from '../ui';

export function ProfileScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const { desktop } = useLayout();
  const { sesion, logout, facilitador } = useSession();
  const rol = useRol();
  const instituciones = useInstituciones(facilitador.estado === 'listo' ? facilitador.id : null);
  const toast = useToast();
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const fieldStyle = desktop ? s.half : s.full;

  // La galería se abre directo desde el toque: en la PWA el navegador lo exige.
  async function cambiarFoto() {
    setCargandoFoto(true);
    try {
      const uri = await elegirFoto();
      if (uri) {
        await app.setFoto(uri);
        toast.success('Foto actualizada', { description: 'Queda guardada solo en este dispositivo.' });
      }
    } catch (e) {
      toast.error('No se pudo cargar la foto', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCargandoFoto(false);
    }
  }

  async function quitarFoto() {
    try {
      await app.setFoto(null);
    } catch (e) {
      toast.error('No se pudo quitar la foto', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  // Solo lectura: son los datos del usuario logueado (login de ethos), no se editan desde la app.
  const datos = [
    { label: 'Nombre completo', valor: sesion?.nombre || app.name },
    { label: 'Usuario', valor: sesion?.usuario ?? '' },
    { label: 'Correo electrónico', valor: sesion?.email ?? '' },
  ];

  return (
    <>
      <View style={{ maxWidth: 730 }}>
        <PageTitle title="Mi perfil" subtitle="Tu información y tu comunidad educativa." />
        <View style={[s.banner, { paddingTop: desktop ? 4 : 0 }]}>
          <Pressable
            onPress={() => void cambiarFoto()}
            disabled={cargandoFoto}
            accessibilityRole="button"
            accessibilityLabel={app.foto ? 'Cambiar foto de perfil' : 'Cargar foto de perfil'}
            style={({ pressed }) => pressed && { opacity: 0.8 }}
          >
            <Avatar initials={iniciales(app.name)} uri={app.foto} size={76} />
            <View style={s.camara} pointerEvents="none">
              <Camera size={13} color={colors.primaryForeground} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text weight="bold" size={20}>
              {app.name}
            </Text>
            <Text size={13} color={colors.mutedForeground} style={{ marginTop: 6 }}>
              {rol}
            </Text>
            <View style={[s.row, { marginTop: 12, flexWrap: 'wrap' }]}>
              <Button
                variant="outline"
                size="sm"
                icon={Camera}
                label={cargandoFoto ? 'Cargando…' : app.foto ? 'Cambiar foto' : 'Cargar foto'}
                onPress={() => void cambiarFoto()}
                disabled={cargandoFoto}
              />
              {app.foto && <Button variant="ghost" size="sm" icon={Trash2} label="Quitar" onPress={() => void quitarFoto()} disabled={cargandoFoto} />}
            </View>
          </View>
        </View>

        <View style={[s.row, { marginBottom: 6 }]}>
          <Text weight="bold" size={16}>
            Información personal
          </Text>
          <Lock size={14} color={colors.mutedForeground} />
        </View>
        <Text size={12} color={colors.mutedForeground} style={{ marginBottom: 18 }}>
          Son los datos de tu usuario. Para corregirlos, pedíselo a tu coordinador.
        </Text>
        <View style={s.grid}>
          {datos.map((d) => (
            <View key={d.label} style={[fieldStyle, s.dato]} accessibilityLabel={`${d.label}: ${d.valor || 'sin dato'}`}>
              <Text weight="semibold" size={12} style={{ marginBottom: 8 }}>
                {d.label}
              </Text>
              <View style={s.valor}>
                <Text size={14} color={d.valor ? colors.foreground : colors.mutedForeground} selectable>
                  {d.valor || '—'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Appearance />

        <Ayuda />

        {instituciones.tipo !== 'oculto' && (
          <Text weight="bold" size={16} style={{ marginTop: 38, marginBottom: 18 }}>
            Mis instituciones
          </Text>
        )}
        {instituciones.tipo === 'cargando' && <ActivityIndicator color={colors.mutedForeground} style={{ alignSelf: 'flex-start', marginBottom: 12 }} accessibilityLabel="Cargando tus instituciones" />}
        {instituciones.tipo === 'error' && (
          <View style={{ marginBottom: 12, gap: 8, alignItems: 'flex-start' }}>
            <Text size={12} color={colors.destructive} accessibilityRole="alert">
              No se pudieron cargar tus instituciones.
            </Text>
            <Button variant="outline" size="sm" label="Reintentar" onPress={instituciones.reintentar} />
          </View>
        )}
        {instituciones.tipo === 'listo' && !instituciones.lista.length && (
          <Text size={12} color={colors.mutedForeground} style={{ marginBottom: 12 }}>
            No tenés instituciones asignadas en el año lectivo actual.
          </Text>
        )}
        {instituciones.tipo === 'listo' &&
          instituciones.lista.map((inst) => (
          <Card key={inst.nombre} style={{ marginBottom: 12 }}>
            <View style={s.row}>
              <Building2 size={17} color={colors.mutedForeground} />
              <Text size={12} color={colors.mutedForeground} style={{ flexShrink: 1 }}>
                {inst.nombre}
              </Text>
            </View>
            {!!inst.lugar && (
              <View style={[s.row, { marginTop: 12 }]}>
                <MapPin size={13} color={colors.mutedForeground} />
                <Text size={11} color={colors.mutedForeground}>
                  {inst.lugar}
                </Text>
              </View>
            )}
          </Card>
        ))}
        <Button variant="outline" icon={LogOut} label="Cerrar sesión" onPress={() => void logout()} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </View>
    </>
  );
}

type Institucion = { nombre: string; lugar: string };
type Instituciones = { tipo: 'oculto' } | { tipo: 'cargando' } | { tipo: 'error'; reintentar: () => void } | { tipo: 'listo'; lista: Institucion[] };

/** Instituciones distintas de mi-agenda. Sin facilitador resuelto y no nulo no se pide nada (aislamiento). */
function useInstituciones(id: number | null): Instituciones {
  const [r, setR] = useState<{ id: number; lista: Institucion[] | null } | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarAgenda()
      .then((a) => {
        const vistas = new Map<string, Institucion>();
        for (const c of a.clases) {
          if (!c.institucion || vistas.has(c.institucion)) continue;
          vistas.set(c.institucion, { nombre: c.institucion, lugar: [c.ciudad, c.departamento].filter(Boolean).join(' · ') });
        }
        if (vigente) setR({ id, lista: [...vistas.values()] });
      })
      .catch(() => vigente && setR({ id, lista: null }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);
  if (id === null) return { tipo: 'oculto' };
  if (!r || r.id !== id) return { tipo: 'cargando' };
  if (r.lista === null) return { tipo: 'error', reintentar: () => { setR(null); setIntento((n) => n + 1); } };
  return { tipo: 'listo', lista: r.lista };
}

const modes: { id: AppearanceMode; label: string; icon: LucideIcon }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Automático', icon: Smartphone },
];

function Appearance() {
  const { colors, scheme, mode, setMode, themeId, setThemeId } = useTheme();
  const s = useStyles();
  const { desktop } = useLayout();

  return (
    <View style={{ marginTop: 38 }}>
      <Text weight="bold" size={16} style={{ marginBottom: 6 }}>
        Apariencia
      </Text>
      <Text size={12} color={colors.mutedForeground} style={{ marginBottom: 18 }}>
        Se guarda en este dispositivo.
      </Text>

      <View style={s.labelRow}>
        <SunMoon size={15} color={colors.foreground} />
        <Text weight="semibold" size={12}>
          Modo
        </Text>
      </View>
      <View style={s.segmented} accessibilityRole="radiogroup">
        {modes.map((m) => {
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityLabel={`Modo ${m.label.toLowerCase()}`}
              accessibilityState={{ checked: active }}
              onPress={() => setMode(m.id)}
              style={[s.segment, active && s.segmentActive]}
            >
              <m.icon size={16} color={active ? colors.primaryText : colors.mutedForeground} />
              <Text size={12} weight={active ? 'bold' : 'medium'} color={active ? colors.primaryText : colors.mutedForeground}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[s.labelRow, { marginTop: 24 }]}>
        <Palette size={15} color={colors.foreground} />
        <Text weight="semibold" size={12}>
          Tema de color
        </Text>
      </View>
      <View style={s.themeGrid} accessibilityRole="radiogroup">
        {themes.map((t) => {
          const p = palettes[t.id][scheme];
          const active = themeId === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="radio"
              accessibilityLabel={`Tema ${t.name}`}
              accessibilityState={{ checked: active }}
              onPress={() => setThemeId(t.id)}
              style={({ pressed }) => [s.themeCard, { width: desktop ? '31.8%' : '48%' }, active && s.themeCardActive, pressed && { opacity: 0.8 }]}
            >
              <View style={[s.preview, { backgroundColor: p.background, borderColor: p.border }]}>
                <View style={[s.previewBar, { backgroundColor: p.primary }]} />
                <View style={s.swatches}>
                  {[p.primary, p.success, p.accent].map((c, i) => (
                    <View key={i} style={[s.swatch, { backgroundColor: c, borderColor: p.card }]} />
                  ))}
                </View>
              </View>
              <View style={s.themeText}>
                <View style={{ flex: 1 }}>
                  <Text weight="bold" size={13}>
                    {t.name}
                  </Text>
                  <Text size={10} color={colors.mutedForeground} style={{ marginTop: 2 }}>
                    {t.description}
                  </Text>
                </View>
                {active && (
                  <View style={s.check}>
                    <Check size={12} color={colors.primaryForeground} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    camara: { position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, borderWidth: 2, borderColor: c.background, alignItems: 'center', justifyContent: 'center' },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingBottom: 28, marginBottom: 25, borderBottomWidth: 1, borderBottomColor: c.border },
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
    half: { width: '48%', flexGrow: 1 },
    full: { width: '100%' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dato: { marginBottom: 18 },
    valor: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.muted },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    segmented: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: c.muted, borderRadius: radius.lg },
    segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, borderRadius: radius.md },
    segmentActive: { backgroundColor: c.card, ...c.shadow, borderWidth: c.scheme === 'dark' ? 1 : 0, borderColor: c.border },
    themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
    themeCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 10 },
    themeCardActive: { borderWidth: 2, borderColor: c.primary, padding: 9 },
    preview: { height: 64, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', justifyContent: 'flex-end' },
    previewBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 14 },
    swatches: { flexDirection: 'row', padding: 8 },
    swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginRight: -6 },
    themeText: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
    check: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  }),
);
