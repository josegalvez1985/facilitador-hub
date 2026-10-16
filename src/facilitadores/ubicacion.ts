import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

// Ubicación de Marcar (acción dinámica "PosicionActual" de la página 2 de APEX), pero MÁS
// exacta que APEX (que usaba enable_high_accuracy = N): se pide el GPS con la máxima
// precisión y se va afinando EN SEGUNDO PLANO mientras el facilitador completa el formulario,
// sin mostrarle nada (solo aparece un aviso si falta el permiso o el GPS). Se queda siempre
// con la posición de menor error; al guardar se envía la mejor obtenida hasta ese momento.
// Las coordenadas viajan con todos sus decimales.

/** Metros: con esto ya no mejora más y se deja de escuchar el GPS. */
const PRECISION_BUENA = 5;
/** Tope de escucha para no gastar batería si la pantalla queda abierta. */
const ESPERA_MAXIMA = 3 * 60_000;
/** Se descartan las posiciones viejas que el sistema tenía guardadas (pueden ser de otro lugar). */
const ANTIGUEDAD_MAXIMA = 10_000;

export type Ubicacion =
  | { estado: 'buscando' }
  /** `afinando`: ya se puede usar, pero todavía puede mejorar. */
  | { estado: 'lista'; latitud: string; longitud: string; precision: number | null; afinando: boolean }
  | { estado: 'sin-permiso' }
  | { estado: 'error'; mensaje: string };

const precisionDe = (p: Location.LocationObject) => p.coords.accuracy ?? Number.POSITIVE_INFINITY;

const aLista = (p: Location.LocationObject, afinando: boolean): Ubicacion => ({
  estado: 'lista',
  latitud: String(p.coords.latitude),
  longitud: String(p.coords.longitude),
  precision: p.coords.accuracy ?? null,
  afinando,
});

/** `activa`: solo con true se pide permiso y se enciende el GPS (facilitadores que requieren ubicación). */
export function useUbicacion(activa: boolean) {
  const [ubicacion, setUbicacion] = useState<Ubicacion>({ estado: 'buscando' });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activa) return;
    let vigente = true;
    let terminado = false;
    let sub: Location.LocationSubscription | null = null;
    let corte: ReturnType<typeof setTimeout> | null = null;
    let mejor: Location.LocationObject | null = null;
    const inicio = Date.now();

    const terminar = () => {
      terminado = true;
      sub?.remove();
      sub = null;
      if (corte) clearTimeout(corte);
      if (!vigente) return;
      setUbicacion(mejor ? aLista(mejor, false) : { estado: 'error', mensaje: 'No se pudo obtener la ubicación. Revisá que el GPS esté activado.' });
    };

    void (async () => {
      try {
        const permiso = await Location.requestForegroundPermissionsAsync();
        if (!vigente) return;
        if (permiso.status !== 'granted') {
          setUbicacion({ estado: 'sin-permiso' });
          return;
        }
        const s = await Location.watchPositionAsync(
          // BestForNavigation = GPS a máxima precisión. En Android, si el GPS o la
          // "precisión de ubicación" están apagados, ofrece activarlos.
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: true },
          (p) => {
            if (!vigente || terminado || p.timestamp < inicio - ANTIGUEDAD_MAXIMA) return;
            if (!mejor || precisionDe(p) < precisionDe(mejor)) mejor = p;
            if (precisionDe(mejor) <= PRECISION_BUENA) terminar();
            else setUbicacion(aLista(mejor, true));
          },
          (motivo) => {
            // Sin ningún dato todavía, es un error; si ya hay uno, se sigue con ese.
            if (vigente && !mejor) setUbicacion({ estado: 'error', mensaje: motivo || 'No se pudo obtener la ubicación' });
          },
        );
        sub = s;
        if (!vigente || terminado) {
          s.remove();
          return;
        }
        corte = setTimeout(terminar, ESPERA_MAXIMA);
      } catch (e) {
        if (vigente) setUbicacion({ estado: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo obtener la ubicación' });
      }
    })();

    return () => {
      vigente = false;
      sub?.remove();
      if (corte) clearTimeout(corte);
    };
  }, [activa, intento]);

  const reintentar = useCallback(() => {
    setUbicacion({ estado: 'buscando' });
    setIntento((n) => n + 1);
  }, []);

  return { ubicacion, reintentar };
}
