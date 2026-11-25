import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { UserRound, X, type LucideIcon } from 'lucide-react-native';

import { alpha, fonts, radius, toneColors, type FontWeight, type Palette, type Tone } from './theme';
import { makeStyles, useTheme } from './theme-provider';

const logo = require('../../assets/images/logo.png');

type TextProps = RNTextProps & { weight?: FontWeight; size?: number; color?: string };

export function Text({ weight = 'regular', size = 14, color, style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...props} style={[{ fontFamily: fonts[weight], fontSize: size, color: color ?? colors.foreground }, style]} />;
}

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

type ButtonProps = {
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
  disabled?: boolean;
};

function variantStyles(c: Palette, variant: ButtonVariant): { box: ViewStyle; text: string } {
  switch (variant) {
    case 'outline':
      return { box: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border }, text: c.foreground };
    case 'secondary':
      return { box: { backgroundColor: c.secondary }, text: c.primaryText };
    case 'ghost':
      return { box: { backgroundColor: 'transparent' }, text: c.foreground };
    case 'link':
      return { box: { backgroundColor: 'transparent', paddingHorizontal: 0 }, text: c.primaryText };
    default:
      return { box: { backgroundColor: c.primary }, text: c.primaryForeground };
  }
}

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  default: { height: 38, paddingHorizontal: 16 },
  sm: { height: 34, paddingHorizontal: 12 },
  lg: { height: 44, paddingHorizontal: 28 },
  icon: { height: 38, width: 38, paddingHorizontal: 0 },
};

export function Button({ label, onPress, variant = 'default', size = 'default', icon: Icon, iconRight: IconRight, accessibilityLabel, style, textStyle, children, disabled }: ButtonProps) {
  const { colors } = useTheme();
  const v = variantStyles(colors, variant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [base.button, sizeStyles[size], v.box, pressed && { opacity: 0.75 }, disabled && { opacity: 0.5 }, style]}
    >
      {Icon && <Icon size={16} color={v.text} />}
      {label && (
        <Text weight={variant === 'link' ? 'semibold' : 'medium'} size={size === 'sm' ? 12 : 14} color={v.text} style={textStyle}>
          {label}
        </Text>
      )}
      {children}
      {IconRight && <IconRight size={16} color={v.text} />}
    </Pressable>
  );
}

export function Badge({ label, tone = 'primary', icon: Icon, style }: { label: string; tone?: Tone; icon?: LucideIcon; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <View style={[base.badge, { backgroundColor: t.background }, style]}>
      {Icon && <Icon size={11} color={t.color} />}
      <Text weight="semibold" size={10} color={t.color}>
        {label}
      </Text>
    </View>
  );
}

export function StatIcon({ icon: Icon, tone = 'primary', size = 32 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  const { colors } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <View style={[base.statIcon, { width: size, height: size, backgroundColor: t.background }]}>
      <Icon size={Math.round(size * 0.53)} color={t.color} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

export function Notice({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[base.notice, { backgroundColor: colors.successSoft }]}>
      <Text size={12} color={colors.success} style={{ lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}

/** Muestra la foto si hay `uri`; si no, las iniciales. */
export function Avatar({ initials, uri, size = 38 }: { initials: string; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[base.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityLabel="Foto de perfil" />
      ) : (
        <Text weight="bold" size={Math.round(size * 0.34)} color={colors.primaryText}>
          {initials}
        </Text>
      )}
    </View>
  );
}

/**
 * Avatar con aureola: anillo degradé con los colores del tema que gira lento y un brillo suave
 * que "respira". Con "reducir movimiento" activado queda quieto.
 */
export function AvatarAureola({ initials, uri, size = 56 }: { initials: string; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const [giro] = useState(() => new Animated.Value(0));
  const [brillo] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let animaciones: Animated.CompositeAnimation[] = [];
    let vigente = true;
    const nativo = Platform.OS !== 'web';
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (!vigente || reducir) return;
        animaciones = [
          Animated.loop(Animated.timing(giro, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: nativo })),
          Animated.loop(
            Animated.sequence([
              Animated.timing(brillo, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: nativo }),
              Animated.timing(brillo, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: nativo }),
            ]),
          ),
        ];
        animaciones.forEach((a) => a.start());
      });
    return () => {
      vigente = false;
      animaciones.forEach((a) => a.stop());
    };
  }, [giro, brillo]);

  const anillo = Math.max(3, Math.round(size * 0.06));
  const total = size + anillo * 4; // anillo + separación a cada lado
  const circulo = { width: total, height: total, borderRadius: total / 2 };
  const rotate = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const opacity = brillo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const scale = brillo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={[circulo, base.avatar]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, circulo, { backgroundColor: alpha(colors.primary, 0.18), boxShadow: `0 0 ${Math.round(size * 0.4)}px ${alpha(colors.primary, 0.55)}`, opacity, transform: [{ scale }] }]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, circulo, { overflow: 'hidden', transform: [{ rotate }] }]}>
        <LinearGradient colors={[colors.primary, colors.accent, colors.success, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={{ padding: anillo, borderRadius: total / 2, backgroundColor: colors.background }}>
        <Avatar initials={initials} uri={uri} size={size} />
      </View>
    </View>
  );
}

export function Dot({ color }: { color?: string }) {
  const { colors } = useTheme();
  return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color ?? colors.primaryText }} />;
}

export function Brand({ size = 22 }: { size?: number }) {
  return (
    <View style={base.brand}>
      <Image source={logo} style={base.brandMark} accessibilityLabel="Logo de facilitadores" />
      <Text weight="extrabold" size={size}>
        facilitadores
      </Text>
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; icon?: LucideIcon; right?: ReactNode };

export function Field({ label, icon: Icon, right, style, ...props }: FieldProps) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={base.field}>
      <View style={base.fieldLabel}>
        {Icon && <Icon size={14} color={colors.foreground} />}
        <Text weight="semibold" size={12}>
          {label}
        </Text>
      </View>
      <View>
        <TextInput placeholderTextColor={colors.mutedForeground} keyboardAppearance={colors.scheme} {...props} style={[s.input, right ? { paddingRight: 48 } : null, style]} />
        {right && <View style={base.fieldRight}>{right}</View>}
      </View>
    </View>
  );
}

type ModalProps = { visible: boolean; onClose: () => void; title: string; label?: string; children: ReactNode; closeLabel?: string };

export function Modal({ visible, onClose, title, label, children, closeLabel = 'Cerrar' }: ModalProps) {
  const s = useStyles();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
        <View style={s.modal} accessibilityViewIsModal accessibilityLabel={label ?? title}>
          <View style={base.modalHead}>
            <Text weight="bold" size={20} style={{ flex: 1 }}>
              {title}
            </Text>
            <Button variant="ghost" size="icon" icon={X} accessibilityLabel={closeLabel} onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

export function ModalText({ children, strong }: { children: ReactNode; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text size={12} weight={strong ? 'semibold' : 'regular'} color={strong ? colors.foreground : colors.mutedForeground} style={{ lineHeight: 22 }}>
      {children}
    </Text>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <View style={base.modalActions}>{children}</View>;
}

export function SectionHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <View style={base.sectionHeading}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>{typeof title === 'string' ? <Text weight="bold" size={16}>{title}</Text> : title}</View>
      {children}
    </View>
  );
}

/** Estado vacío compartido de las secciones que son solo para facilitadores registrados. */
export function SinFacilitador() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 16 }}>
      <UserRound size={24} color={colors.mutedForeground} />
      <Text color={colors.mutedForeground} style={{ textAlign: 'center', lineHeight: 21, maxWidth: 420 }}>
        Esta sección es para quienes ya están registrados como facilitadores/as. Si querés sumarte, completá tu postulación.
      </Text>
      <Button label="Ir a Mi postulación" onPress={() => router.navigate('/postulacion')} />
    </View>
  );
}

/** `leading`: algo a la izquierda del título (p. ej. la foto en el inicio). */
export function PageTitle({ title, subtitle, leading, children }: { title: ReactNode; subtitle: string; leading?: ReactNode; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={base.welcomeRow}>
      <View style={base.titleRow}>
        {leading}
        <View style={{ flexShrink: 1 }}>
          <Text weight="bold" size={27} style={{ lineHeight: 36 }}>
            {title}
          </Text>
          <Text size={13} color={colors.mutedForeground} style={{ marginTop: 6 }}>
            {subtitle}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

// Estilos que no dependen del tema.
const base = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 4 },
  statIcon: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  notice: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, marginVertical: 15 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 10 },
  field: { gap: 8, marginBottom: 18 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldRight: { position: 'absolute', right: 3, top: 3 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 18, ...c.shadow },
    input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, minHeight: 43, paddingHorizontal: 12, paddingVertical: 10, color: c.foreground, fontFamily: fonts.regular, fontSize: 14 },
    overlay: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
    modal: { width: '100%', maxWidth: 440, backgroundColor: c.card, borderRadius: radius.lg, padding: 24, borderWidth: c.scheme === 'dark' ? 1 : 0, borderColor: c.border, ...c.shadow },
  }),
);
