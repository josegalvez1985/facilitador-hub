import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Download, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react-native';

import { descargarApk, ofrecerApk } from '../descarga-apk';
import { getPasswordRecordada, getUsuarioRecordado, setPasswordRecordada, setUsuarioRecordado } from '../auth/recordar';
import { useSession } from '../auth/session';
import { useLayout } from '../shell';
import { alpha, radius } from '../theme';
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
  const [apk] = useState(ofrecerApk);

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

  const formulario = (
    <>
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
          {apk && (
            <View style={s.apk}>
              <Button variant="outline" icon={Download} label="Descargar la app para Android" onPress={descargarApk} />
              <Text size={12} color={colors.mutedForeground} style={{ textAlign: 'center', marginTop: 8 }}>
                Abrí el archivo en tu celular para instalarla.
              </Text>
            </View>
          )}
          <Text size={10} color={colors.mutedForeground} style={{ textAlign: 'center', marginTop: 40 }}>
            © {new Date().getFullYear()} Facilitadores · Tu vocación nos conecta.
          </Text>
    </>
  );

  if (!desktop) return <LoginCelular>{formulario}</LoginCelular>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={[s.wrap, { flexDirection: 'row' }]}>
      <View style={{ flex: 1 }}>
        <Image source={classroom} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Profesora y estudiantes compartiendo una clase" />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.panel, { paddingHorizontal: 60 }]}>
          <View style={{ marginBottom: 60 }}>
            <Brand />
          </View>
          {formulario}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Login en celular (APK y web móvil): arriba la foto del aula fundida con el color del tema,
 * y el formulario en una tarjeta que sube sobre la foto. Con "reducir movimiento" aparece sin animar.
 */
function LoginCelular({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [entrada] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (!vigente) return;
        if (reducir) entrada.setValue(1);
        else Animated.timing(entrada, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
      });
    return () => {
      vigente = false;
    };
  }, [entrada]);

  const tint = colors.heroTint;
  // La foto ocupa ~38 % de la pantalla, con piso y techo para teléfonos muy chicos o muy altos.
  const alturaFoto = Math.round(Math.min(340, Math.max(220, height * 0.38))) + insets.top;
  const translateY = entrada.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={s.wrap}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={{ height: alturaFoto }}>
          <Image source={classroom} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: '62%', top: '45%' }} accessibilityLabel="Profesora y estudiantes compartiendo una clase" />
          {/* Arriba, velo suave para que se lea la barra de estado; abajo, el color del tema donde va el logo. */}
          <LinearGradient style={StyleSheet.absoluteFill} colors={[alpha(tint, 0.7), alpha(tint, 0.1), alpha(tint, 0.65), tint]} locations={[0, 0.3, 0.72, 1]} />
          <Animated.View style={[s.marca, { opacity: entrada }]}>
            <Brand />
          </Animated.View>
        </View>
        <Animated.View style={[s.hoja, { paddingBottom: insets.bottom + 24, opacity: entrada, transform: [{ translateY }] }]}>
          <View style={s.manija} />
          {children}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.card },
    scroll: { flexGrow: 1, justifyContent: 'center' },
    panel: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    marca: { position: 'absolute', left: 24, bottom: 44 },
    hoja: {
      flexGrow: 1,
      marginTop: -28,
      paddingHorizontal: 24,
      paddingTop: 14,
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      boxShadow: `0 -10px 30px ${alpha(colors.foreground, colors.scheme === 'dark' ? 0.35 : 0.1)}`,
    },
    manija: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 22 },
    // 16 px: Safari de iOS (PWA) no hace zoom al enfocar el campo.
    input16: { fontSize: 16 },
    apk: { marginTop: 22, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.border },
    remember: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, marginBottom: 18, alignSelf: 'flex-start' },
    checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.mutedForeground, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  }),
);
