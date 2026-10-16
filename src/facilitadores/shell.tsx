import { useEffect, useState, type ReactNode } from 'react';
import { Modal as RNModal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Bell, BookOpen, CalendarDays, ChevronRight, CircleHelp, ClipboardCheck, History, LayoutGrid, ListChecks, LogOut, MapPin, Menu, Plus, UserRound, X, type LucideIcon } from 'lucide-react-native';

import { useSession } from './auth/session';
import { demoUser, iniciales } from './data';
import { fechaLarga } from './fechas';
import { MarkModal } from './mark-modal';
import { useApp } from './provider';
import { PanelProximaClase, useProximaClase } from './proxima-clase';
import { breakpoints, radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Avatar, Brand, Button, Dot, Modal, ModalActions, ModalText, Notice, Text } from './ui';

type NavItem = { href: Href; path: string; label: string; short: string; icon: LucideIcon; title: string };

export const nav: NavItem[] = [
  { href: '/', path: '/', label: 'Inicio', short: 'Inicio', icon: LayoutGrid, title: 'Inicio' },
  { href: '/marcar', path: '/marcar', label: 'Registrar intervención', short: 'Marcar', icon: MapPin, title: 'Registrar intervención' },
  { href: '/intervenciones', path: '/intervenciones', label: 'Intervenciones realizadas', short: 'Realizadas', icon: History, title: 'Intervenciones realizadas' },
  { href: '/historial', path: '/historial', label: 'Historial de intervenciones', short: 'Historial', icon: ListChecks, title: 'Historial de intervenciones' },
  { href: '/horarios', path: '/horarios', label: 'Mi agenda', short: 'Agenda', icon: CalendarDays, title: 'Mi agenda' },
  { href: '/materiales', path: '/materiales', label: 'Mis materiales', short: 'Materiales', icon: BookOpen, title: 'Mis materiales' },
  { href: '/evaluaciones', path: '/evaluaciones', label: 'Evaluaciones', short: 'Evaluaciones', icon: ClipboardCheck, title: 'Evaluaciones' },
  { href: '/perfil', path: '/perfil', label: 'Mi perfil', short: 'Perfil', icon: UserRound, title: 'Mi perfil' },
];

/** Secciones con botón propio en la barra inferior del celular. Todas las de `nav` están además en Menú. */
const barraInferior = ['/', '/marcar', '/perfil'];

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, desktop: width >= breakpoints.desktop, wide: width >= breakpoints.wide };
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const app = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { desktop, wide } = useLayout();
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [salir, setSalir] = useState(false);
  const title = nav.find((n) => n.path === path)?.title ?? 'Inicio';
  // En celular, "Menú" queda marcado cuando la sección actual no tiene botón propio en la barra.
  const enMenu = !barraInferior.includes(path);

  useEffect(() => {
    if (Platform.OS === 'web') document.title = `${title} · Facilitadores`;
  }, [title]);

  // Campana: el punto marca una próxima clase que todavía no se vio; al abrir el panel queda vista
  // hasta que la próxima clase cambie (por la hora o porque cambió la agenda).
  const proxima = useProximaClase();
  const claveNotificacion = proxima.tipo === 'listo' ? (proxima.proxima?.clave ?? null) : null;
  const [vista, setVista] = useState<string | null>(null);
  const hayNueva = claveNotificacion !== null && claveNotificacion !== vista;
  const abrirNotificaciones = () => {
    if (!notifications && claveNotificacion) setVista(claveNotificacion);
    setNotifications(!notifications);
  };

  const go = (href: Href) => {
    setNotifications(false);
    router.navigate(href);
  };
  const { logout: cerrarSesion } = useSession();
  // El guardia lleva solo al login cuando la sesión queda en null.
  const logout = () => void cerrarSesion();

  return (
    <View style={[s.root, desktop && { flexDirection: 'row' }]}>
      {desktop && (
        <View style={[s.sidebar, { width: wide ? 242 : 205, paddingHorizontal: wide ? 22 : 15 }]}>
          <Pressable onPress={() => go('/')} accessibilityRole="link" accessibilityLabel="Facilitadores, inicio">
            <Brand size={wide ? 22 : 19} />
          </Pressable>
          <Text weight="bold" size={10} color={colors.mutedForeground} style={s.navLabel}>
            MI ESPACIO
          </Text>
          {nav.map((n) => {
            const active = path === n.path;
            return (
              <Pressable
                key={n.path}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => go(n.href)}
                style={({ pressed }) => [s.navItem, active && s.navItemActive, pressed && !active && { backgroundColor: colors.muted }]}
              >
                <n.icon size={20} color={active ? colors.primaryText : colors.mutedForeground} />
                <Text weight={active ? 'bold' : 'medium'} color={active ? colors.primaryText : colors.mutedForeground} style={{ flex: 1 }}>
                  {n.label}
                </Text>
                {active && <Dot />}
              </Pressable>
            );
          })}
          <View style={{ marginTop: 'auto' }}>
            <Button variant="ghost" icon={CircleHelp} label="Centro de ayuda" onPress={() => setHelp(true)} style={{ justifyContent: 'flex-start', paddingHorizontal: 12 }} />
            <View style={s.sidebarPerson}>
              <Avatar initials={iniciales(app.name)} uri={app.foto} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="bold" size={12} numberOfLines={1}>
                  {app.name}
                </Text>
                <Text size={10} color={colors.mutedForeground} style={{ marginTop: 3 }}>
                  {demoUser.role}
                </Text>
              </View>
              <Button variant="ghost" size="icon" icon={LogOut} accessibilityLabel="Cerrar sesión" onPress={logout} />
            </View>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={[s.topbar, desktop ? { height: 84, paddingHorizontal: wide ? 38 : 24 } : { height: 64 + insets.top, paddingTop: insets.top, paddingHorizontal: 20 }]}>
          {desktop ? (
            <Text weight="semibold" size={15}>
              {title}
            </Text>
          ) : (
            <Pressable onPress={() => go('/')} accessibilityRole="link" accessibilityLabel="Facilitadores, inicio">
              <Brand size={20} />
            </Pressable>
          )}
          <View style={s.topbarRight}>
            {desktop && (
              <Text size={12} color={colors.mutedForeground}>
                {fechaLarga()}
              </Text>
            )}
            <View>
              <Button variant="ghost" size="icon" icon={Bell} accessibilityLabel={hayNueva ? 'Notificaciones, 1 nueva' : 'Notificaciones'} onPress={abrirNotificaciones} />
              {hayNueva && (
                <View style={s.bellDot} pointerEvents="none">
                  <Dot />
                </View>
              )}
            </View>
          </View>
        </View>

        <ScrollView key={path} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.workspace, desktop ? { padding: wide ? 38 : 24, paddingTop: wide ? 32 : 28 } : { padding: 20, paddingTop: 24 }]}>
          {children}
          {desktop && (
            <View style={s.footer}>
              <Text size={10} color={colors.mutedForeground}>
                © {new Date().getFullYear()} Facilitadores
              </Text>
              <Text size={10} color={colors.mutedForeground}>
                Hecho para quienes transforman la educación.
              </Text>
            </View>
          )}
        </ScrollView>

        {notifications && (
          <View style={[s.notificationPanel, { top: (desktop ? 84 : 64 + insets.top) - 6, right: desktop ? (wide ? 38 : 24) : 16 }]}>
            <Text weight="bold" size={13} style={{ marginBottom: 12 }}>
              Tu próxima clase
            </Text>
            <PanelProximaClase estado={proxima} onVerAgenda={() => go('/horarios')} />
          </View>
        )}

        {!desktop && (
          // Inicio · [Marcar] · Menú · Perfil · Salir. El resto de las secciones está en Menú.
          <View style={[s.bottomNav, { paddingBottom: Math.max(10, insets.bottom) }]}>
            <BottomItem icon={LayoutGrid} label="Inicio" active={path === '/'} role="link" onPress={() => go('/')} />
            {/* Marcar = página 2 de APEX (Intervención) */}
            <Pressable accessibilityRole="link" accessibilityLabel="Marcar" accessibilityState={{ selected: path === '/marcar' }} onPress={() => go('/marcar')} style={s.bottomItem}>
              <View style={s.navPlus}>
                <Plus size={20} color={colors.primaryForeground} />
              </View>
              <Text size={10} color={colors.mutedForeground}>
                Marcar
              </Text>
            </Pressable>
            <BottomItem icon={Menu} label="Menú" active={menu || enMenu} onPress={() => setMenu(true)} />
            <BottomItem icon={UserRound} label="Perfil" active={path === '/perfil'} role="link" onPress={() => go('/perfil')} />
            <BottomItem icon={LogOut} label="Salir" onPress={() => setSalir(true)} />
          </View>
        )}
      </View>

      {!desktop && (
        <MenuSheet
          visible={menu}
          path={path}
          onClose={() => setMenu(false)}
          onNavigate={(href) => {
            setMenu(false);
            go(href);
          }}
          onHelp={() => {
            setMenu(false);
            setHelp(true);
          }}
        />
      )}
      <Modal visible={salir} onClose={() => setSalir(false)} title="¿Cerrar sesión?" closeLabel="Cancelar">
        <ModalText>Vas a salir de Facilitadores. Para volver a entrar necesitás tu usuario y contraseña.</ModalText>
        <ModalActions>
          <Button variant="outline" label="Cancelar" onPress={() => setSalir(false)} />
          <Button
            icon={LogOut}
            label="Salir"
            onPress={() => {
              setSalir(false);
              logout();
            }}
          />
        </ModalActions>
      </Modal>

      <MarkModal />
      <Modal visible={help} onClose={() => setHelp(false)} title="Centro de ayuda" closeLabel="Cerrar ayuda">
        <ModalText>Para asistencia con tus horarios o instituciones, comunícate con tu coordinador educativo.</ModalText>
        <Notice>Las marcaciones y los datos de esta versión son de demostración.</Notice>
      </Modal>
    </View>
  );
}

function BottomItem({ icon: Icon, label, active = false, role = 'button', onPress }: { icon: LucideIcon; label: string; active?: boolean; role?: 'button' | 'link'; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const color = active ? colors.primaryText : colors.mutedForeground;
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={s.bottomItem}>
      <Icon size={20} color={color} />
      <Text size={10} numberOfLines={1} weight={active ? 'bold' : 'regular'} color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Panel inferior con TODAS las secciones (`nav`) y el Centro de ayuda. Las secciones nuevas aparecen solas. */
function MenuSheet({ visible, path, onClose, onNavigate, onHelp }: { visible: boolean; path: string; onClose: () => void; onNavigate: (href: Href) => void; onHelp: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const app = useApp();
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar menú" />
        <View style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]} accessibilityViewIsModal accessibilityLabel="Menú">
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <Avatar initials={iniciales(app.name)} uri={app.foto} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="bold" size={14} numberOfLines={1}>
                {app.name}
              </Text>
              <Text size={11} color={colors.mutedForeground}>
                {demoUser.role}
              </Text>
            </View>
            <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Cerrar menú" onPress={onClose} />
          </View>
          <Text weight="bold" size={10} color={colors.mutedForeground} style={s.sheetLabel}>
            MI ESPACIO
          </Text>
          <ScrollView style={{ flexGrow: 0 }}>
            {nav.map((n) => {
              const active = path === n.path;
              return (
                <Pressable
                  key={n.path}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => onNavigate(n.href)}
                  style={({ pressed }) => [s.navItem, active && s.navItemActive, pressed && !active && { backgroundColor: colors.muted }]}
                >
                  <n.icon size={20} color={active ? colors.primaryText : colors.mutedForeground} />
                  <Text weight={active ? 'bold' : 'medium'} color={active ? colors.primaryText : colors.foreground} style={{ flex: 1 }}>
                    {n.label}
                  </Text>
                  {active ? <Dot /> : <ChevronRight size={16} color={colors.mutedForeground} />}
                </Pressable>
              );
            })}
            <View style={s.sheetDivider} />
            <Pressable accessibilityRole="button" onPress={onHelp} style={({ pressed }) => [s.navItem, pressed && { backgroundColor: colors.muted }]}>
              <CircleHelp size={20} color={colors.mutedForeground} />
              <Text weight="medium" style={{ flex: 1 }}>
                Centro de ayuda
              </Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    sidebar: { backgroundColor: c.card, borderRightWidth: 1, borderRightColor: c.border, paddingTop: 35, paddingBottom: 22 },
    navLabel: { letterSpacing: 1.6, marginTop: 46, marginBottom: 16, marginHorizontal: 12 },
    navItem: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 47, marginBottom: 7, paddingHorizontal: 14, borderRadius: 7 },
    navItemActive: { backgroundColor: c.secondary },
    sidebarPerson: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: c.border, marginTop: 22, paddingTop: 23 },
    topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
    topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bellDot: { position: 'absolute', top: 9, right: 10 },
    workspace: { width: '100%', maxWidth: 1460, alignSelf: 'center' },
    footer: { marginTop: 32, flexDirection: 'row', justifyContent: 'space-between' },
    notificationPanel: { position: 'absolute', width: 280, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 20, borderRadius: radius.lg, zIndex: 40, elevation: 6, ...c.shadow },
    bottomNav: { flexDirection: 'row', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, paddingHorizontal: 9 },
    bottomItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4 },
    navPlus: { width: 46, height: 46, marginTop: -26, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderWidth: 4, borderColor: c.background, borderRadius: 15 },
    sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    sheet: { backgroundColor: c.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, maxHeight: '85%', borderWidth: c.scheme === 'dark' ? 1 : 0, borderColor: c.border },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    sheetLabel: { letterSpacing: 1.6, marginTop: 16, marginBottom: 8, marginHorizontal: 14 },
    sheetDivider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
  }),
);
