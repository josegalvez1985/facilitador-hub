import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpenCheck, Building2, CircleCheck, Clock3, MapPin, UserRound } from 'lucide-react-native';

import { DIAS_AGENDA, manualCompleto, type ClaseAgenda, type DiaAgenda, type Horario } from './agenda';
import { COLOR_MANUAL } from './intervenciones';
import { Grade } from './lesson-card';
import { makeStyles, useTheme } from './theme-provider';
import { Badge, Button, Card, Text } from './ui';

const CORTO: Record<DiaAgenda, string> = { lunes: 'LUN', martes: 'MAR', miercoles: 'MIÉ', jueves: 'JUE', viernes: 'VIE' };

/**
 * Una fila de V_AGENDA (página 3 de APEX). Se usa en Mis horarios y en "Tus clases de hoy".
 * Con `horario` muestra el de un día; sin él, todos los días con clase.
 * Con `esHoy` agrega el botón Marcar (página 2).
 */
export function ClaseCard({ clase, horario, esHoy }: { clase: ClaseAgenda; horario?: Horario; esHoy?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const router = useRouter();
  const color = clase.manual ? (COLOR_MANUAL[clase.manual] ?? colors.border) : colors.border;
  const titulo = [clase.grado && `${clase.grado} grado`, clase.seccion && `Sección ${clase.seccion}`].filter(Boolean).join(' · ');
  return (
    <Card style={[s.clase, { borderLeftColor: color }]}>
      <View style={s.claseTop}>
        {horario ? (
          <View style={s.fila}>
            <Clock3 size={14} color={colors.foreground} />
            <Text weight="bold" size={14}>
              {horario.desde}
              {horario.hasta ? ` – ${horario.hasta}` : ''}
            </Text>
          </View>
        ) : (
          <View style={[s.fila, { flexWrap: 'wrap', flex: 1 }]}>
            {DIAS_AGENDA.filter((d) => clase.dias[d]).map((d) => (
              <Badge key={d} label={`${CORTO[d]} ${clase.dias[d]?.desde}–${clase.dias[d]?.hasta}`} />
            ))}
          </View>
        )}
        {clase.turnoDescripcion ? <Badge tone={clase.turno === 1 ? 'accent' : 'primary'} label={clase.turnoDescripcion} /> : null}
      </View>

      <Text weight="bold" size={15} style={{ marginTop: 10 }}>
        {titulo || 'Clase'}
      </Text>
      <View style={[s.fila, { marginTop: 6 }]}>
        <Building2 size={13} color={colors.mutedForeground} />
        <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>
          {clase.institucion}
        </Text>
      </View>
      {clase.profesor && (
        <View style={[s.fila, { marginTop: 4 }]}>
          <UserRound size={13} color={colors.mutedForeground} />
          <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>
            Prof. {clase.profesor}
          </Text>
        </View>
      )}
      {(clase.ciudad || clase.departamento) && (
        <View style={[s.fila, { marginTop: 4 }]}>
          <MapPin size={13} color={colors.mutedForeground} />
          <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>
            {[clase.ciudad, clase.departamento].filter(Boolean).join(', ')}
          </Text>
        </View>
      )}

      <IndiceManual clase={clase} color={color} />

      <View style={s.claseFooter}>
        <View style={[s.fila, { flex: 1, flexWrap: 'wrap' }]}>
          {clase.manual && (
            <View style={[s.manual, { borderColor: color }]}>
              <View style={[s.punto, { backgroundColor: color }]} />
              <Text size={11} weight="semibold">
                {clase.manual}
              </Text>
            </View>
          )}
          {clase.enfasis && <Grade label={`Énfasis: ${clase.enfasis}`} />}
        </View>
        {esHoy && <Button size="sm" icon={MapPin} label="Marcar" onPress={() => router.navigate('/marcar')} />}
      </View>
    </Card>
  );
}

/** Siguiente índice al último desarrollado, con el avance del manual. */
export function IndiceManual({ clase, color, compacto }: { clase: ClaseAgenda; color: string; compacto?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  if (!clase.manual || clase.indicesTotal === 0) return null;
  const completo = manualCompleto(clase);
  const avance = Math.min(1, clase.indicesDesarrollados / clase.indicesTotal);
  return (
    <View style={[s.indice, compacto && { marginTop: 6, padding: 0, backgroundColor: 'transparent' }]}>
      <View style={s.fila}>
        {completo ? <CircleCheck size={14} color={colors.success} /> : <BookOpenCheck size={14} color={colors.primaryText} />}
        <Text size={11} color={colors.mutedForeground}>
          {completo ? 'Manual completado' : 'Próximo índice'}
        </Text>
        <Text size={11} color={colors.mutedForeground} style={{ marginLeft: 'auto' }}>
          {clase.indicesDesarrollados} de {clase.indicesTotal}
        </Text>
      </View>
      {!completo && clase.indiceSiguiente && (
        <Text weight="semibold" size={compacto ? 12 : 13} numberOfLines={compacto ? 1 : 2} style={{ marginTop: 4 }}>
          {clase.indiceSiguiente.titulo}
        </Text>
      )}
      {!compacto && (
        <View style={s.barra} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[s.barraFill, { width: `${avance * 100}%`, backgroundColor: completo ? colors.success : color }]} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    indice: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: c.muted },
    barra: { height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: 8, overflow: 'hidden' },
    barraFill: { height: 4, borderRadius: 2 },
    clase: { marginBottom: 12, borderLeftWidth: 4 },
    claseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    claseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14 },
    manual: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    punto: { width: 8, height: 8, borderRadius: 4 },
  }),
);
