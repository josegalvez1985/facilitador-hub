---
name: pantalla-expo
description: Cómo construir o modificar una pantalla de la app (Expo Router + React Native + TypeScript) con los patrones del proyecto - ruta, módulo de datos con authFetch, aislamiento del facilitador, estados de carga/error/vacío, tema, responsive, teclado y accesibilidad. Usar al crear o cambiar cualquier pantalla o componente de src/.
---

# Pantalla nueva o modificada

Antes de escribir: leer `AGENTS.md` y una pantalla parecida. Referencia corta: `src/facilitadores/screens/materials.tsx` + `src/facilitadores/materiales.ts`. Para APIs de Expo, consultar https://docs.expo.dev/versions/v58.0.0/ (no la memoria).

## Archivos
| Qué | Dónde |
|---|---|
| Ruta (2 líneas, solo re-exporta) | `src/app/(app)/<ruta>.tsx` |
| Pantalla | `src/facilitadores/screens/<area>.tsx` |
| Datos y tipos | `src/facilitadores/<area>.ts` |
| Navegación | entrada en el array `nav` de `src/facilitadores/shell.tsx` (nunca en `barraInferior`) |

```tsx
// src/app/(app)/<ruta>.tsx
import { AreaScreen } from '@/facilitadores/screens/area';

export default AreaScreen;
```

## Datos
- Siempre `authFetch('<endpoint>')` de `src/facilitadores/auth/api.ts`; `filasDe(r)` para leer `data`/`items`. Nunca `fetch` con `Authorization`.
- Convertir la respuesta a tipos propios (camelCase, `Date | null`) en el módulo de datos, no en la pantalla.
- Si un endpoint viejo recibe `id_facilitador`: mandar el de sesión y filtrar con `soloDelFacilitador()`.

## Estados obligatorios en la pantalla
```tsx
const { facilitador, reintentarFacilitador } = useSession();
// Sin ID_FACILITADOR no se piden datos (aislamiento entre facilitadores).
const id = facilitador.estado === 'listo' ? facilitador.id : null;
useEffect(() => {
  if (id === null) return;
  let vigente = true;
  cargarArea()
    .then((r) => vigente && setResultado(/* listo */))
    .catch((e: unknown) => vigente && setResultado(/* error con mensaje */));
  return () => { vigente = false; };
}, [id, intento]);
```
1. `facilitador.id === null` → "Tu usuario no está registrado como facilitador." (sin pedir nada).
2. Error (del facilitador o de la carga) → mensaje + botón **Reintentar** (`reintentarFacilitador()` o `setIntento(n + 1)`). "Sin conexión" no cierra la sesión.
3. Cargando → `ActivityIndicator` + texto ("Cargando tus …").
4. Vacío → texto que explica por qué y qué hacer.
5. Datos.

Excepción única: `mi-postulacion`, abierta a cualquier usuario logueado.

## Estilo
- Componentes de `src/facilitadores/ui.tsx` (`Card`, `Button`, `Badge`, `PageTitle`, `Text`…) antes de crear nuevos.
- `const useStyles = makeStyles((c) => StyleSheet.create({ … }))` al final del archivo; `const { colors } = useTheme()` para colores puntuales. Nunca colores literales.
- Gráficos: `colors.chart` + valores en texto. Manuales: `COLOR_MANUAL`.
- `useLayout()` (`desktop`, `wide`) para adaptar a escritorio; diseñar primero para el celular.
- Fechas: `src/facilitadores/fechas.ts`. Nunca `toLocaleDateString` ni fechas fijas.
- Textos en español con "vos"; "facilitadores" sin punto final.

## Plataformas
- Solo primitivas RN; nada de DOM/CSS. Si algo es solo web (descargas, `document`), protegerlo con `Platform.OS === 'web'`.
- Inputs: el shell ya tiene `KeyboardAvoidingView`; verificar que el campo activo no quede tapado.
- Trabajo pesado (SVG grandes, PDF) no en el hilo principal de Android: ver skill `depuracion-sistematica` / agente `mobile-native`.
- Módulo nativo nuevo (`npx expo install`) → avisar que hace falta APK nuevo.

## Accesibilidad
- `accessibilityRole` y `accessibilityLabel` en botones solo con ícono; `accessibilityState` en filtros/pestañas.
- Áreas táctiles de 44 px como mínimo (`hitSlop` si el ícono es chico).
- Animaciones respetan "reducir movimiento".
- Contraste AA: colores nuevos del tema pasan el test de contraste de `__tests__/app.test.tsx` (correrlo solo si el usuario pidió tests).

## Cierre
- Si cambia lo que el usuario ve o hace: `docs/manual-usuario.md` + `npm run manual`.
- `npm run typecheck` y `npx eslint <archivos cambiados>`. Decir que los tests no se corrieron.
