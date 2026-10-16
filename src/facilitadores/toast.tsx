import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck } from 'lucide-react-native';

import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Text } from './ui';

type ToastItem = { id: string; type: 'success' | 'error'; title: string; description?: string };
type Opciones = { id?: string; description?: string };
type Ctx = { success: (title: string, o?: Opciones) => void; error: (title: string, o?: Opciones) => void };

const ToastContext = createContext<Ctx | null>(null);
const DURACION = 4000;

// Avisos breves (equivalente a sonner). Un mismo `id` reemplaza al aviso anterior en lugar de apilarlo.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const quitar = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const mostrar = useCallback(
    (type: ToastItem['type'], title: string, o: Opciones = {}) => {
      const id = o.id ?? `${Date.now()}-${Math.random()}`;
      setItems((prev) => [...prev.filter((t) => t.id !== id), { id, type, title, ...(o.description ? { description: o.description } : {}) }]);
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => quitar(id), DURACION));
    },
    [quitar],
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const value = useMemo<Ctx>(() => ({ success: (t, o) => mostrar('success', t, o), error: (t, o) => mostrar('error', t, o) }), [mostrar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster items={items} onClose={quitar} />
    </ToastContext.Provider>
  );
}

function Toaster({ items, onClose }: { items: ToastItem[]; onClose: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={[s.host, { top: insets.top + 12 }]}>
      {items.map((t) => {
        const Icon = t.type === 'success' ? CircleCheck : CircleAlert;
        const tint = t.type === 'success' ? colors.success : colors.destructive;
        return (
          <Pressable key={t.id} onPress={() => onClose(t.id)} accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.toast}>
            <Icon size={18} color={tint} />
            <View style={{ flex: 1 }}>
              <Text weight="bold" size={13}>
                {t.title}
              </Text>
              {t.description ? (
                <Text size={12} color={colors.mutedForeground} style={{ marginTop: 2 }}>
                  {t.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error('ToastProvider missing');
  return c;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    host: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8, zIndex: 100, elevation: 10 },
    toast: { width: '100%', maxWidth: 420, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' },
  }),
);
