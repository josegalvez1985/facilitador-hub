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

import { colors, fonts, radius, shadow, tones, type FontWeight, type Tone } from './theme';

const logo = require('../../assets/images/logo.png');

type TextProps = RNTextProps & { weight?: FontWeight; size?: number; color?: string };

export function Text({ weight = 'regular', size = 14, color = colors.foreground, style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts[weight], fontSize: size, color }, style]} />;
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

const variantStyles: Record<ButtonVariant, { box: ViewStyle; text: string }> = {
  default: { box: { backgroundColor: colors.primary }, text: colors.primaryForeground },
  outline: { box: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }, text: colors.foreground },
  secondary: { box: { backgroundColor: colors.secondary }, text: colors.primary },
  ghost: { box: { backgroundColor: 'transparent' }, text: colors.foreground },
  link: { box: { backgroundColor: 'transparent', paddingHorizontal: 0 }, text: colors.primary },
};

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  default: { height: 38, paddingHorizontal: 16 },
  sm: { height: 34, paddingHorizontal: 12 },
  lg: { height: 44, paddingHorizontal: 28 },
  icon: { height: 38, width: 38, paddingHorizontal: 0 },
};

export function Button({ label, onPress, variant = 'default', size = 'default', icon: Icon, iconRight: IconRight, accessibilityLabel, style, textStyle, children, disabled }: ButtonProps) {
  const v = variantStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, sizeStyles[size], v.box, pressed && { opacity: 0.75 }, disabled && { opacity: 0.5 }, style]}
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
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.background }, style]}>
      {Icon && <Icon size={11} color={t.color} />}
      <Text weight="semibold" size={10} color={t.color}>
        {label}
      </Text>
    </View>
  );
}

export function StatIcon({ icon: Icon, tone = 'primary', size = 32 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  const t = tones[tone];
  return (
    <View style={[styles.statIcon, { width: size, height: size, backgroundColor: t.background }]}>
      <Icon size={Math.round(size * 0.53)} color={t.color} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text size={12} color={colors.teal} style={{ lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}

export function Avatar({ initials, size = 38 }: { initials: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text weight="bold" size={Math.round(size * 0.34)} color={colors.primary}>
        {initials}
      </Text>
    </View>
  );
}

export function Dot({ color = colors.primary }: { color?: string }) {
  return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />;
}

export function Brand({ size = 22 }: { size?: number }) {
  return (
    <View style={styles.brand}>
      <Image source={logo} style={styles.brandMark} accessibilityLabel="Logo de Facilitadores" />
      <Text weight="extrabold" size={size}>
        facilitadores<Text weight="extrabold" size={size} color={colors.primary}>.</Text>
      </Text>
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; icon?: LucideIcon; right?: ReactNode };

export function Field({ label, icon: Icon, right, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        {Icon && <Icon size={14} color={colors.foreground} />}
        <Text weight="semibold" size={12}>
          {label}
        </Text>
      </View>
      <View>
        <TextInput placeholderTextColor={colors.mutedForeground} {...props} style={[styles.input, right ? { paddingRight: 48 } : null, style]} />
        {right && <View style={styles.fieldRight}>{right}</View>}
      </View>
    </View>
  );
}

type ModalProps = { visible: boolean; onClose: () => void; title: string; label?: string; children: ReactNode; closeLabel?: string };

export function Modal({ visible, onClose, title, label, children, closeLabel = 'Cerrar' }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
        <View style={styles.modal} accessibilityViewIsModal accessibilityLabel={label ?? title}>
          <View style={styles.modalHead}>
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
  return (
    <Text size={12} weight={strong ? 'semibold' : 'regular'} color={strong ? colors.foreground : colors.mutedForeground} style={{ lineHeight: 22 }}>
      {children}
    </Text>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <View style={styles.modalActions}>{children}</View>;
}

export function SectionHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>{typeof title === 'string' ? <Text weight="bold" size={16}>{title}</Text> : title}</View>
      {children}
    </View>
  );
}

export function PageTitle({ title, subtitle, children }: { title: ReactNode; subtitle: string; children?: ReactNode }) {
  return (
    <View style={styles.welcomeRow}>
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

export const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 4 },
  statIcon: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, ...shadow },
  notice: { backgroundColor: colors.tealSoft, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, marginVertical: 15 },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 10 },
  field: { gap: 8, marginBottom: 18 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 43, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontFamily: fonts.regular, fontSize: 14 },
  fieldRight: { position: 'absolute', right: 3, top: 3 },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 440, backgroundColor: colors.card, borderRadius: radius.lg, padding: 24, ...shadow },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
});
