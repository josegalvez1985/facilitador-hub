import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, Check, LogOut, MapPin } from 'lucide-react-native';

import { demoUser, institutions } from '../data';
import { useApp } from '../provider';
import { useLayout } from '../shell';
import { colors } from '../theme';
import { Avatar, Badge, Button, Card, Field, Notice, PageTitle, Text } from '../ui';

export function ProfileScreen() {
  const app = useApp();
  const router = useRouter();
  const { desktop } = useLayout();
  const [name, setName] = useState(app.name);
  const [email, setEmail] = useState(demoUser.email);
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState(demoUser.city);
  const [saved, setSaved] = useState(false);
  const fieldStyle = desktop ? s.half : s.full;

  const save = () => {
    if (!name.trim()) return;
    app.setName(name.trim());
    setSaved(true);
  };

  return (
    <>
      <View style={{ maxWidth: 730 }}>
        <PageTitle title="Mi perfil" subtitle="Tu información y tu comunidad educativa." />
        <View style={[s.banner, { paddingTop: desktop ? 4 : 0 }]}>
          <Avatar initials={demoUser.initials} size={76} />
          <View style={{ flex: 1 }}>
            <Text weight="bold" size={20}>
              {app.name}
            </Text>
            <Text size={13} color={colors.mutedForeground} style={{ marginTop: 6 }}>
              Facilitadora educativa
            </Text>
            <Badge tone="teal" icon={Check} label="Perfil activo" style={{ marginTop: 12 }} />
          </View>
        </View>

        <Text weight="bold" size={16} style={{ marginBottom: 22 }}>
          Información personal
        </Text>
        <View style={s.grid}>
          <View style={fieldStyle}>
            <Field label="Nombre completo" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} autoComplete="name" />
          </View>
          <View style={fieldStyle}>
            <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          </View>
          <View style={fieldStyle}>
            <Field label="Teléfono" value={phone} onChangeText={setPhone} placeholder="Tu número de teléfono" keyboardType="phone-pad" autoComplete="tel" />
          </View>
          <View style={fieldStyle}>
            <Field label="Ciudad" value={city} onChangeText={setCity} />
          </View>
        </View>
        <Button icon={Check} label="Guardar cambios" onPress={save} disabled={!name.trim()} style={{ alignSelf: 'flex-start' }} />
        {saved && <Notice>Cambios guardados en esta demostración.</Notice>}

        <Text weight="bold" size={16} style={{ marginTop: 38, marginBottom: 18 }}>
          Mis instituciones
        </Text>
        {institutions.map((inst) => (
          <Card key={inst} style={{ marginBottom: 12 }}>
            <View style={s.row}>
              <Building2 size={17} color={colors.mutedForeground} />
              <Text size={12} color={colors.mutedForeground} style={{ flexShrink: 1 }}>
                {inst}
              </Text>
            </View>
            <View style={[s.row, { marginTop: 12 }]}>
              <MapPin size={13} color={colors.mutedForeground} />
              <Text size={11} color={colors.mutedForeground}>
                Asunción, Paraguay
              </Text>
            </View>
          </Card>
        ))}
        <Button variant="outline" icon={LogOut} label="Cerrar sesión" onPress={() => router.replace('/login')} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingBottom: 28, marginBottom: 25, borderBottomWidth: 1, borderBottomColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  half: { width: '48%', flexGrow: 1 },
  full: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
