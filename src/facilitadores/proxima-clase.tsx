// Notificación de la campana: próxima clase a la que hay que entrar, según la hora actual.
// Sale de la agenda real del facilitador del token (GET mi-agenda, ver agenda.ts).

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BookOpen, Building2, Clock } from 'lucide-react-native';

import { aMinutos, cargarAgenda, clasesDelDia, diaAgenda, manualCompleto, type ClaseAgenda, type Horario } from './agenda';
import { useSession } from './auth/session';
import { diaYMes, hoy, numeroDeDia, sumarDias } from './fechas';
import { makeStyles, useTheme } from './theme-provider';
import { Button, Text } from './ui';

export type ProximaClase = {
  clase: ClaseAgenda;
  horario: Horario;
  fecha: Date;
  /** 0 = hoy, 1 = mañana… */
  enDias: number;
  /** Minutos que faltan para que empiece (solo si es hoy). */
  faltan: number | null;
  /** Identifica la notificación: al cambiar, el punto de "nueva" vuelve a aparecer. */
  clave: string;
};

/** Hoy, la primera clase que todavía no empezó; si no queda ninguna, la primera del siguiente día con clases (hasta una semana). */
export function proximaClase(clases: ClaseAgenda[], ahora: Date): ProximaClase | null {
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  for (let n = 0; n < 7; n++) {
    const fecha = sumarDias(ahora, n);
    const [c] = clasesDelDia(clases, diaAgenda(fecha))
      .filter((x) => n > 0 || aMinutos(x.horario.desde) >= minutos)
      .sort((a, b) => aMinutos(a.horario.desde) - aMinutos(b.horario.desde));
    if (c) {
      return {
        clase: c,
        horario: c.horario,
        fecha,
        enDias: n,
        faltan: n === 0 ? aMinutos(c.horario.desde) - minutos : null,
        clave: `${numeroDeDia(fecha)}|${c.idPostulacion}|${c.horario.desde}`,
      };
    }
  }
  return null;
}

export type EstadoProxima =
  | { tipo: 'cargando' }
  | { tipo: 'sin-facilitador' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; proxima: ProximaClase | null };

/** Carga la agenda una vez por facilitador y recalcula la próxima clase cada minuto. */
export function useProximaClase(): EstadoProxima {
  const { facilitador } = useSession();
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const [agenda, setAgenda] = useState<{ id: number; clases: ClaseAgenda[] } | { id: number; error: string } | null>(null);
  const [ahora, setAhora] = useState(hoy);

  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarAgenda()
      .then((a) => vigente && setAgenda({ id, clases: a.clases }))
      .catch((e: unknown) => vigente && setAgenda({ id, error: e instanceof Error ? e.message : 'No disponible' }));
    return () => {
      vigente = false;
    };
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setAhora(hoy()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (facilitador.estado === 'listo' && facilitador.id === null) return { tipo: 'sin-facilitador' };
  if (facilitador.estado === 'error') return { tipo: 'error', mensaje: facilitador.mensaje };
  if (!agenda || agenda.id !== id) return { tipo: 'cargando' };
  if ('error' in agenda) return { tipo: 'error', mensaje: agenda.error };
  return { tipo: 'listo', proxima: proximaClase(agenda.clases, ahora) };
}

function cuando(p: ProximaClase) {
  if (p.enDias === 0) {
    const f = p.faltan ?? 0;
    if (f === 0) return 'Hoy · empieza ahora';
    return f < 60 ? `Hoy · en ${f} min` : `Hoy · en ${Math.floor(f / 60)} h ${String(f % 60).padStart(2, '0')} min`;
  }
  return p.enDias === 1 ? 'Mañana' : diaYMes(p.fecha);
}

export function PanelProximaClase({ estado, onVerAgenda }: { estado: EstadoProxima; onVerAgenda: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();

  if (estado.tipo === 'cargando') {
    return (
      <View style={s.fila}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Text size={12} color={colors.mutedForeground}>
          Buscando tu próxima clase…
        </Text>
      </View>
    );
  }
  if (estado.tipo !== 'listo' || !estado.proxima) {
    const texto =
      estado.tipo === 'error' ? `No se pudo cargar tu agenda. ${estado.mensaje}` : estado.tipo === 'sin-facilitador' ? 'Tu usuario no tiene agenda de facilitador.' : 'No tenés clases en los próximos días.';
    return (
      <Text size={12} color={estado.tipo === 'error' ? colors.destructive : colors.mutedForeground} style={{ lineHeight: 19 }}>
        {texto}
      </Text>
    );
  }

  const { clase: c, horario } = estado.proxima;
  const curso = [c.grado, c.seccion && `sección ${c.seccion}`, c.turnoDescripcion && `turno ${c.turnoDescripcion.toLowerCase()}`].filter(Boolean).join(' · ');
  const manual = c.manual ? (manualCompleto(c) ? `${c.manual} · completado` : c.indiceSiguiente ? `${c.manual} · sigue ${c.indiceSiguiente.nro !== null ? `${c.indiceSiguiente.nro}. ` : ''}${c.indiceSiguiente.titulo}` : c.manual) : null;

  return (
    <View accessibilityLabel={`Próxima clase: ${cuando(estado.proxima)}, de ${horario.desde} a ${horario.hasta}, ${c.institucion}, ${curso}`}>
      <Text size={11} weight="bold" color={colors.primaryText} style={{ letterSpacing: 0.4 }}>
        {cuando(estado.proxima).toUpperCase()}
      </Text>
      <View style={[s.fila, { marginTop: 8 }]}>
        <Clock size={15} color={colors.foreground} />
        <Text weight="bold" size={15}>
          {horario.desde}
          {horario.hasta ? ` – ${horario.hasta}` : ''}
        </Text>
      </View>
      <View style={[s.fila, { marginTop: 8, alignItems: 'flex-start' }]}>
        <Building2 size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text weight="semibold" size={12} style={{ lineHeight: 18 }}>
            {c.institucion || 'Institución sin nombre'}
          </Text>
          {!!curso && (
            <Text size={11} color={colors.mutedForeground} style={{ lineHeight: 17 }}>
              {curso}
            </Text>
          )}
        </View>
      </View>
      {manual && (
        <View style={[s.fila, { marginTop: 8, alignItems: 'flex-start' }]}>
          <BookOpen size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
          <Text size={11} color={colors.mutedForeground} style={{ flex: 1, lineHeight: 17 }}>
            {manual}
          </Text>
        </View>
      )}
      <Button variant="outline" size="sm" label="Ver mi agenda" onPress={onVerAgenda} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  }),
);
