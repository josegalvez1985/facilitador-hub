// Aviso de "faltan datos o archivos para terminar la postulación" (Jose, 24/11/2026): en Inicio,
// en la campana de notificaciones y en Mi postulación. Sale de GET mi-postulacion, que devuelve
// solo lo del usuario logueado (sea o no facilitador). Ningún campo es obligatorio para guardar,
// así que el aviso dice qué falta: los datos de cada paso y los archivos.
// Inicio y la campana comparten UNA consulta (caché por usuario); Mi postulación la actualiza
// cada vez que carga (fijarAviso), así el aviso no queda viejo después de guardar o enviar.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRight, Clock, TriangleAlert } from 'lucide-react-native';

import { useSession } from './auth/session';
import { cargarPostulacion, faltantes, PASOS_A_COMPLETAR, pasosCompletos, textoCierre, type EstadoPostulacion, type PasoFaltante } from './postulacion';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { Button, Text } from './ui';

export type AvisoPostulacion = {
  anio: string;
  /**
   * sin-empezar: no la empezó · sin-terminar: guardada y nunca enviada · cambios: enviada, con
   * cambios guardados sin enviar · incompleta: enviada, pero le falta algo (p. ej. un archivo nuevo).
   */
  tipo: 'sin-empezar' | 'sin-terminar' | 'cambios' | 'incompleta';
  pasos: PasoFaltante[];
  archivos: string[];
  /** "Cierra hoy" / "Cierra mañana" / "Cierra en N días" cuando falta poco para el cierre; si no, null. */
  cierre: string | null;
};

/** Qué avisar, o null si no hay nada pendiente (o la postulación no está abierta). */
export function avisoDe(e: EstadoPostulacion): AvisoPostulacion | null {
  if (!e.abierta) return null;
  const cierre = textoCierre(e);
  if (e.guardada) {
    const f = faltantes(e.guardada.datos);
    return { anio: e.anio, tipo: e.postulacion ? 'cambios' : 'sin-terminar', ...f, cierre };
  }
  if (e.postulacion) {
    const f = faltantes(e.postulacion.datos);
    return f.pasos.length || f.archivos.length ? { anio: e.anio, tipo: 'incompleta', ...f, cierre } : null;
  }
  return { anio: e.anio, tipo: 'sin-empezar', pasos: [], archivos: [], cierre };
}

/** Identifica el aviso: si cambia, el punto de "nueva" de la campana vuelve a aparecer. */
export const claveDeAviso = (a: AvisoPostulacion) => `${a.anio}|${a.tipo}|${a.pasos.map((p) => `${p.paso}:${p.campos.length}`).join(',')}|${a.archivos.length}|${a.cierre ?? ''}`;

/* ------------------------------------------------------------------------- */
/* Una sola consulta para Inicio y la campana                                */
/* ------------------------------------------------------------------------- */

let cache: { clave: string; promesa: Promise<AvisoPostulacion | null> } | null = null;
const oyentes = new Set<() => void>();

function avisoPara(clave: string): Promise<AvisoPostulacion | null> {
  if (!cache || cache.clave !== clave) {
    cache = { clave, promesa: cargarPostulacion().then(avisoDe, () => null) };
  }
  return cache.promesa;
}

function claveDeSesion(usuario: string | undefined, facilitador: ReturnType<typeof useSession>['facilitador']) {
  return facilitador.estado === 'listo' ? `${usuario ?? ''}-${facilitador.id ?? ''}` : null;
}

/** Mi postulación ya cargó el estado: se lo pasa al aviso (sin otra consulta) y lo actualiza. */
export function useFijarAviso() {
  const { sesion, facilitador } = useSession();
  const clave = claveDeSesion(sesion?.usuario, facilitador);
  return (e: EstadoPostulacion) => {
    if (clave === null) return;
    cache = { clave, promesa: Promise.resolve(avisoDe(e)) };
    oyentes.forEach((f) => f());
  };
}

/** El aviso del usuario logueado, o null. Sin sesión resuelta (o si falla) no muestra nada. */
export function useAvisoPostulacion(): AvisoPostulacion | null {
  const { sesion, facilitador } = useSession();
  const clave = claveDeSesion(sesion?.usuario, facilitador);
  const [version, setVersion] = useState(0);
  const [r, setR] = useState<{ clave: string; aviso: AvisoPostulacion | null } | null>(null);

  useEffect(() => {
    const f = () => setVersion((v) => v + 1);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);

  useEffect(() => {
    if (clave === null) return;
    let vigente = true;
    void avisoPara(clave).then((aviso) => vigente && setR({ clave: `${clave}#${version}`, aviso }));
    return () => {
      vigente = false;
    };
  }, [clave, version]);

  return r && r.clave === `${clave}#${version}` ? r.aviso : null;
}

/* ------------------------------------------------------------------------- */
/* La tarjeta                                                                */
/* ------------------------------------------------------------------------- */

/** "departamento, ciudad, dirección y 2 más". */
function lista(campos: string[], max = 4) {
  if (campos.length <= max) return campos.join(', ');
  return `${campos.slice(0, max).join(', ')} y ${campos.length - max} más`;
}

/** El plazo destacado: "Cierra hoy", "Cierra mañana", "Cierra en 3 días". */
export function PildoraPlazo({ texto, compacta = false }: { texto: string; compacta?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.plazo} accessible accessibilityLabel={`Plazo: ${texto}`}>
      <Clock size={compacta ? 12 : 14} color={colors.accent} />
      <Text size={compacta ? 12 : 13} weight="bold">
        {texto}
      </Text>
    </View>
  );
}

/** Barra de avance con el texto "3 de 9 pasos completos". */
export function AvancePostulacion({ completos, compacta = false }: { completos: number; compacta?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const total = PASOS_A_COMPLETAR;
  return (
    <View style={{ gap: 4 }}>
      <Text size={compacta ? 12 : 13} weight="semibold">
        {completos} de {total} pasos completos
      </Text>
      <View style={s.barra} accessibilityRole="progressbar" accessibilityLabel="Avance de tu postulación" accessibilityValue={{ min: 0, max: total, now: completos }}>
        <View style={[s.barraRelleno, { width: `${(completos / total) * 100}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

/** El detalle por paso de lo que falta (para Mi postulación). */
export function DetalleFaltantes({ aviso }: { aviso: Pick<AvisoPostulacion, 'pasos' | 'archivos'> }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {aviso.pasos.length > 0 && (
        <View style={{ gap: 3 }}>
          <Text size={13} weight="semibold">
            Faltan datos
          </Text>
          {aviso.pasos.map((p) => (
            <Text key={p.paso} size={13} style={{ lineHeight: 19 }}>
              • <Text size={13} weight="semibold">{p.titulo}:</Text> {lista(p.campos)}
            </Text>
          ))}
        </View>
      )}
      {aviso.archivos.length > 0 && (
        <View style={{ gap: 3 }}>
          <Text size={13} weight="semibold">
            Faltan archivos
          </Text>
          <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 19 }}>
            {aviso.archivos.join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * La tarjeta del aviso, compacta: título, avance, archivos en una línea, plazo y botón. Con
 * `onCompletar` muestra el botón para ir a terminarla; `compacta` para la campana; `detalle`
 * agrega lo que falta paso por paso (Mi postulación).
 */
export function TarjetaAviso({ aviso, onCompletar, compacta = false, detalle = false }: { aviso: AvisoPostulacion; onCompletar?: () => void; compacta?: boolean; detalle?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const nada = aviso.pasos.length === 0 && aviso.archivos.length === 0;
  const titulo =
    aviso.tipo === 'sin-empezar'
      ? `La postulación ${aviso.anio} está abierta`
      : aviso.tipo === 'cambios'
        ? `Tenés cambios sin enviar en tu postulación ${aviso.anio}`
        : aviso.tipo === 'incompleta'
          ? `A tu postulación ${aviso.anio} le faltan datos`
          : `Tu postulación ${aviso.anio} no está terminada`;
  const boton = aviso.tipo === 'sin-empezar' ? 'Empezar mi postulación' : nada ? 'Enviar mi postulación' : 'Completar mi postulación';
  const tam = compacta ? 12 : 13;

  return (
    <View style={[s.tarjeta, compacta && { padding: 12 }]} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <TriangleAlert size={compacta ? 16 : 20} color={colors.accent} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: compacta ? 6 : 8 }}>
          <Text weight="bold" size={compacta ? 13 : 15}>
            {titulo}
          </Text>
          {aviso.tipo === 'sin-empezar' ? (
            <Text size={tam} color={colors.mutedForeground} style={{ lineHeight: 19 }}>
              Todavía no empezaste. Podés hacerla por partes y guardarla sin terminar.
            </Text>
          ) : (
            <>
              <AvancePostulacion completos={pasosCompletos(aviso)} compacta={compacta} />
              {nada ? (
                <Text size={tam} color={colors.mutedForeground} style={{ lineHeight: 19 }}>
                  Ya está todo completo: solo falta que la envíes.
                </Text>
              ) : detalle ? (
                <DetalleFaltantes aviso={aviso} />
              ) : (
                aviso.archivos.length > 0 && (
                  <Text size={tam} color={colors.mutedForeground} style={{ lineHeight: 18 }} numberOfLines={compacta ? 2 : 3}>
                    <Text size={tam} weight="semibold">Faltan archivos: </Text>
                    {lista(aviso.archivos, 3)}
                  </Text>
                )
              )}
            </>
          )}
          {aviso.cierre ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <PildoraPlazo texto={aviso.cierre} compacta={compacta} />
            </View>
          ) : null}
          {onCompletar && <Button size="sm" label={boton} iconRight={ArrowRight} onPress={onCompletar} style={{ alignSelf: 'flex-start', marginTop: 2 }} />}
        </View>
      </View>
    </View>
  );
}

/** Para Inicio: el aviso, solo si hay algo pendiente. */
export function AvisoPostulacionInicio({ onCompletar }: { onCompletar: () => void }) {
  const aviso = useAvisoPostulacion();
  if (!aviso) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <TarjetaAviso aviso={aviso} onCompletar={onCompletar} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    tarjeta: { borderRadius: radius.lg, borderWidth: 1, borderColor: c.accent, backgroundColor: c.accentSoft, padding: 16 },
    plazo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: c.accent, backgroundColor: c.card },
    barra: { height: 6, borderRadius: 3, backgroundColor: c.muted, overflow: 'hidden' },
    barraRelleno: { height: 6, borderRadius: 3 },
  }),
);
