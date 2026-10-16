import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react-native';

import { getPasswordRecordada, getUsuarioRecordado, setPasswordRecordada, setUsuarioRecordado } from '../auth/recordar';
import { useSession } from '../auth/session';
import { useLayout } from '../shell';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { useToast } from '../toast';
import { Brand, Button, Field, Text } from '../ui';

const classroom = require('../../../assets/images/classroom.jpg');

export function LoginScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { desktop } = useLayout();
  const { sesion, login } = useSession();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // replace: que el login no quede en el historial (si no, "atrás" rebota).
  useEffect(() => {
    if (sesion) router.replace('/');
  }, [sesion, router]);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const guardado = await getUsuarioRecordado();
      if (!guardado || !vigente) return;
      const pass = await getPasswordRecordada();
      if (!vigente) return;
      setUsuario(guardado);
      setPassword(pass);
      setRecordar(true);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const onSubmit = async () => {
    if (cargando) return;
    setError('');
    if (!usuario || !password) {
      setError('Ingresa tu usuario y contraseña');
      return;
    }
    setCargando(true);
    try {
      await login(usuario, password);
      // Recién ACÁ, con el login aceptado: si se guardara al tildar el check,
      // una contraseña mal escrita quedaría recordada. Destildado, borra las dos.
      await setUsuarioRecordado(recordar ? usuario : '');
      await setPasswordRecordada(recordar ? password : '');
      toast.success('Bienvenido');
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setCargando(false); // sin esto, un error deja el botón trabado
    }
  };

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
            <Field
              label="Usuario"
              icon={UserRound}
              value={usuario}
              onChangeText={setUsuario}
              placeholder="Tu usuario"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              style={s.input16}
            />
            <Field
              label="Contraseña"
              icon={LockKeyhole}
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
              style={s.input16}
              right={
                <Button size="icon" variant="ghost" icon={visible ? EyeOff : Eye} accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setVisible(!visible)} />
              }
            />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: recordar }} onPress={() => setRecordar(!recordar)} style={s.remember} hitSlop={6}>
              <View style={[s.checkbox, recordar && s.checkboxOn]}>{recordar && <Check size={13} color={colors.primaryForeground} />}</View>
              <Text size={13}>Recordar usuario y contraseña</Text>
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" size={13} color={colors.destructive} style={{ marginBottom: 14 }}>
                {error}
              </Text>
            ) : null}
            <Button label={cargando ? 'Iniciando...' : 'Ingresar'} iconRight={cargando ? undefined : ArrowRight} size="lg" onPress={() => void onSubmit()} disabled={cargando} />
          </View>
          <Text size={10} color={colors.mutedForeground} style={{ textAlign: 'center', marginTop: 40 }}>
            © {new Date().getFullYear()} Facilitadores · Tu vocación nos conecta.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.card },
    scroll: { flexGrow: 1, justifyContent: 'center' },
    panel: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    // 16 px: Safari de iOS (PWA) no hace zoom al enfocar el campo.
    input16: { fontSize: 16 },
    remember: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, marginBottom: 18, alignSelf: 'flex-start' },
    checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.mutedForeground, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  }),
);
