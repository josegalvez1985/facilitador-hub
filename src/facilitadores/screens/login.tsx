import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';

import { useLayout } from '../shell';
import { colors } from '../theme';
import { Brand, Button, Field, Notice, Text } from '../ui';

const classroom = require('../../../assets/images/classroom.jpg');

export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { desktop } = useLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.wrap, desktop && { flexDirection: 'row' }]}>
      {desktop && (
        <View style={{ flex: 1 }}>
          <Image source={classroom} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Profesora y estudiantes compartiendo una clase" />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.panel, { paddingHorizontal: desktop ? 60 : 24 }]}>
          <View style={{ marginBottom: desktop ? 60 : 44 }}>
            <Brand />
          </View>
          <Text weight="bold" size={desktop ? 29 : 25} style={{ lineHeight: desktop ? 39 : 34, marginBottom: 9 }}>
            Qué bueno verte de nuevo.
          </Text>
          <Text size={13} color={colors.mutedForeground}>
            Tu espacio para seguir haciendo la diferencia.
          </Text>

          <View style={{ marginTop: 30 }}>
            <Field label="Correo electrónico" icon={Mail} value={email} onChangeText={setEmail} placeholder="nombre@ejemplo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <Field
              label="Contraseña"
              icon={LockKeyhole}
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry={!visible}
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => valid && setReady(true)}
              right={<Button size="icon" variant="ghost" icon={visible ? EyeOff : Eye} accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setVisible(!visible)} />}
            />
            <Button label="Ingresar" iconRight={ArrowRight} size="lg" onPress={() => setReady(true)} disabled={!valid} />
          </View>
          {ready && <Notice>El acceso con cuenta aún no está conectado. Podés explorar la demostración.</Notice>}
          <Button variant="link" label="Explorar demostración" iconRight={ArrowRight} onPress={() => router.replace('/')} style={{ marginTop: 16, alignSelf: 'center' }} />
          <Text size={10} color={colors.mutedForeground} style={{ textAlign: 'center', marginTop: 40 }}>
            © 2026 Facilitadores · Tu vocación nos conecta.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.card },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  panel: { width: '100%', maxWidth: 560, alignSelf: 'center' },
});
