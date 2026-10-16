import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

// Equivale a la acción dinámica "PosicionActual" de la página 2 de APEX
// (NATIVE_GET_CURRENT_POSITION, enable_high_accuracy = N → precisión "Balanced").

export type Ubicacion =
  | { estado: 'buscando' }
  | { estado: 'lista'; latitud: string; longitud: string; precision: number | null }
  | { estado: 'sin-permiso' }
  | { estado: 'error'; mensaje: string };

async function obtener(): Promise<Ubicacion> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (permiso.status !== 'granted') return { estado: 'sin-permiso' };
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { estado: 'lista', latitud: String(p.coords.latitude), longitud: String(p.coords.longitude), precision: p.coords.accuracy ?? null };
  } catch (e) {
    return { estado: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo obtener la ubicación' };
  }
}

export function useUbicacion() {
  const [ubicacion, setUbicacion] = useState<Ubicacion>({ estado: 'buscando' });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    void obtener().then((u) => vigente && setUbicacion(u));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setUbicacion({ estado: 'buscando' });
    setIntento((n) => n + 1);
  }, []);

  return { ubicacion, reintentar };
}
