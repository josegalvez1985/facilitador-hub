import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Bell, BookOpen, CalendarDays, CircleHelp, LayoutGrid, LogOut, Plus, UserRound, type LucideIcon } from 'lucide-react-native';

import { demoToday, demoUser } from './data';
import { MarkModal } from './mark-modal';
import { useApp } from './provider';
import { breakpoints, colors, radius, shadow } from './theme';
import { Avatar, Brand, Button, Dot, Modal, ModalText, Notice, Text } from './ui';

type NavItem = { href: Href; path: string; label: string; short: string; icon: LucideIcon; title: string };

export const nav: NavItem[] = [
  { href: '/', path: '/', label: 'Inicio', short: 'Inicio', icon: LayoutGrid, title: 'Inicio' },
  { href: '/horarios', path: '/horarios', label: 'Mis horarios', short: 'Horarios', icon: CalendarDays, title: 'Mis horarios' },
  { href: '/materiales', path: '/materiales', label: 'Mis materiales', short: 'Materiales', icon: BookOpen, title: 'Mis materiales' },
  { href: '/perfil', path: '/perfil', label: 'Mi perfil', short: 'Perfil', icon: UserRound, title: 'Mi perfil' },
];

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, desktop: width >= breakpoints.desktop, wide: width >= breakpoints.wide };
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const { desktop, wide } = useLayout();
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const title = nav.find((n) => n.path === path)?.title ?? 'Inicio';

  useEffect(() => {
    if (Platform.OS === 'web') document.title = `${title} · Facilitadores`;
  }, [title]);

  const go = (href: Href) => {
    setNotifications(false);
    router.navigate(href);
  };
  const logout = () => router.replace('/login');

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
                <n.icon size={20} color={active ? colors.primary : colors.mutedForeground} />
                <Text weight={active ? 'bold' : 'medium'} color={active ? colors.primary : colors.mutedForeground} style={{ flex: 1 }}>
                  {n.label}
                </Text>
                {active && <Dot />}
              </Pressable>
            );
          })}
          <View style={{ marginTop: 'auto' }}>
            <Button variant="ghost" icon={CircleHelp} label="Centro de ayuda" onPress={() => setHelp(true)} style={{ justifyContent: 'flex-start', paddingHorizontal: 12 }} />
            <View style={s.sidebarPerson}>
              <Avatar initials={demoUser.initials} />
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
                {demoToday.label}
              </Text>
            )}
            <View>
              <Button variant="ghost" size="icon" icon={Bell} accessibilityLabel="Notificaciones" onPress={() => setNotifications(!notifications)} />
              <View style={s.bellDot} pointerEvents="none">
                <Dot />
              </View>
            </View>
            <Pressable onPress={() => go('/perfil')} accessibilityRole="link" accessibilityLabel="Ver perfil">
              <Avatar initials={demoUser.initials} />
            </Pressable>
          </View>
        </View>

        <ScrollView key={path} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.workspace, desktop ? { padding: wide ? 38 : 24, paddingTop: wide ? 32 : 28 } : { padding: 20, paddingTop: 24 }]}>
          {children}
          {desktop && (
            <View style={s.footer}>
              <Text size={10} color={colors.mutedForeground}>
                © 2026 Facilitadores
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
              Notificaciones
            </Text>
            <Text weight="semibold" size={12} style={{ lineHeight: 20 }}>
              Tu próxima clase comienza a las 08:00
            </Text>
            <Text size={11} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
              Matemática · 5.º grado{'\n'}Escuela Básica San José
            </Text>
          </View>
        )}

        {!desktop && (
          <View style={[s.bottomNav, { paddingBottom: Math.max(10, insets.bottom) }]}>
            {[nav[0], nav[1], null, nav[2], nav[3]].map((n) => {
              if (!n) {
                return (
                  <Pressable key="mark" accessibilityRole="button" accessibilityLabel="Marcar" onPress={() => app.setMarkOpen(true)} style={s.bottomItem}>
                    <View style={s.navPlus}>
                      <Plus size={20} color={colors.primaryForeground} />
                    </View>
                    <Text size={10} color={colors.mutedForeground}>
                      Marcar
                    </Text>
                  </Pressable>
                );
              }
              const active = path === n.path;
              return (
                <Pressable key={n.path} accessibilityRole="link" accessibilityState={{ selected: active }} onPress={() => go(n.href)} style={s.bottomItem}>
                  <n.icon size={20} color={active ? colors.primary : colors.mutedForeground} />
                  <Text size={10} weight={active ? 'bold' : 'regular'} color={active ? colors.primary : colors.mutedForeground}>
                    {n.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <MarkModal />
      <Modal visible={help} onClose={() => setHelp(false)} title="Centro de ayuda" closeLabel="Cerrar ayuda">
        <ModalText>Para asistencia con tus horarios o instituciones, comunícate con tu coordinador educativo.</ModalText>
        <Notice>Las marcaciones y los datos de esta versión son de demostración.</Notice>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  sidebar: { backgroundColor: colors.card, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: 35, paddingBottom: 22 },
  navLabel: { letterSpacing: 1.6, marginTop: 46, marginBottom: 16, marginHorizontal: 12 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 47, marginBottom: 7, paddingHorizontal: 14, borderRadius: 7 },
  navItemActive: { backgroundColor: colors.secondary },
  sidebarPerson: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 22, paddingTop: 23 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellDot: { position: 'absolute', top: 9, right: 10 },
  workspace: { width: '100%', maxWidth: 1460, alignSelf: 'center' },
  footer: { marginTop: 32, flexDirection: 'row', justifyContent: 'space-between' },
  notificationPanel: { position: 'absolute', width: 280, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: radius.lg, zIndex: 40, elevation: 6, ...shadow },
  bottomNav: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, paddingHorizontal: 9 },
  bottomItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4 },
  navPlus: { width: 46, height: 46, marginTop: -26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.background, borderRadius: 15 },
});
