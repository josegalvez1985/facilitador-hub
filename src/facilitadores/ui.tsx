import type { ReactNode } from 'react';
import {
  Modal as RNModal,
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
import { X, type LucideIcon } from 'lucide-react-native';

import { fonts, radius, toneColors, type FontWeight, type Palette, type Tone } from './theme';
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

export function Avatar({ initials, size = 38 }: { initials: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[base.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary }]}>
      <Text weight="bold" size={Math.round(size * 0.34)} color={colors.primaryText}>
        {initials}
      </Text>
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
      <Image source={logo} style={base.brandMark} accessibilityLabel="Logo de Facilitadores" />
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

export function PageTitle({ title, subtitle, children }: { title: ReactNode; subtitle: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={base.welcomeRow}>
      <View style={{ flexShrink: 1 }}>
        <Text weight="bold" size={27} style={{ lineHeight: 36 }}>
          {title}
        </Text>
        <Text size={13} color={colors.mutedForeground} style={{ marginTop: 6 }}>
          {subtitle}
        </Text>
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
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 18, ...c.shadow },
    input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, minHeight: 43, paddingHorizontal: 12, paddingVertical: 10, color: c.foreground, fontFamily: fonts.regular, fontSize: 14 },
    overlay: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
    modal: { width: '100%', maxWidth: 440, backgroundColor: c.card, borderRadius: radius.lg, padding: 24, borderWidth: c.scheme === 'dark' ? 1 : 0, borderColor: c.border, ...c.shadow },
  }),
);
