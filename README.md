# Facilitadores

App para facilitadores educativos: marcar entrada a las clases (con ubicación), organizar horarios, gestionar los manuales e índices desarrollados por grado e institución, ver sus evaluaciones y administrar el perfil.

Es la **modernización de la app Oracle APEX 193573 "Facilitadores"**: cada página de APEX se pasa a una pantalla de esta app y usa el mismo backend.

Está hecha con **React Native + Expo**. Una sola base de código funciona en **Android (APK)**, **iOS (PWA)** y web; la web usa `react-native-web`.

| Parte | Estado |
|---|---|
| Login y sesión | Conectado al backend (ORDS, módulo `ethos`) |
| Evaluaciones (página 11 de APEX) | Conectada: requiere publicar [sql/facilitador_app_ethos.sql](sql/facilitador_app_ethos.sql) |
| Marcar / Registrar intervención (página 2 de APEX) | Conectada, con ubicación real del GPS: requiere publicar [sql/intervenciones_app_ethos.sql](sql/intervenciones_app_ethos.sql) |
| Inicio | KPI **Marcaciones del mes** conectado (`mis-intervenciones/resumen`); el resto, demostración |
| Mis horarios (página 3 de APEX) | Conectada: requiere publicar [sql/agenda_app_ethos.sql](sql/agenda_app_ethos.sql). "Añadir clase" sigue siendo de demostración |
| Mis materiales | Todavía con **datos de demostración** |
| Perfil | Datos del usuario logueado; el modo claro/oscuro y el tema de color se guardan en el dispositivo |

## Requisitos

- Node.js 20 o superior y npm
- Para probar en el celular: la app **Expo Go** (iOS/Android)

## Configuración

La URL del backend va en `.env`:

```sh
EXPO_PUBLIC_API_URL=https://oracleapex.com/ords/fundcarac/ethos/
```

Es el módulo ORDS `ethos`, ya publicado, con los mismos usuarios del sistema anterior (ver [sql/README.md](sql/README.md)). Si la variable falta o tiene un valor de ejemplo, la app usa esa misma URL por defecto.

Expo fija la URL **al compilar**. Si la cambiás, reiniciá el servidor limpiando la caché con `npx expo start --clear`, o volvé a generar el APK o la PWA.

## Desarrollo

```sh
npm install
npm run dev      # (o npm start) servidor de Expo: escaneá el QR con Expo Go, o tocá "w" para la web
npm run web      # versión web en el navegador
npm run android  # emulador Android
npm run ios      # simulador iOS (solo macOS)
```

Antes de dar un cambio por terminado:

```sh
npm run typecheck   # TypeScript
npm run lint        # ESLint (eslint-config-expo)
npm test            # Jest + Testing Library (con el backend simulado)
```

Builds: `npm run build:apk` (Android) y `npm run build:pwa` (iOS/web). Están explicados más abajo.

## Estructura

```
src/
  app/                       Rutas (Expo Router)
    _layout.tsx              Raíz: fuentes, safe area, tema, avisos, sesión
    login.tsx                /login
    (app)/_layout.tsx        Guardia de sesión + shell compartido (menú lateral / barra inferior + Menú)
    (app)/index.tsx          /              Inicio
    (app)/horarios.tsx       /horarios      (página 3 de APEX: Agenda)
    (app)/materiales.tsx     /materiales
    (app)/evaluaciones.tsx   /evaluaciones  (página 11 de APEX)
    (app)/marcar.tsx         /marcar        (página 2 de APEX: Registrar intervención)
    (app)/perfil.tsx         /perfil
  facilitadores/
    auth/
      api.ts                 Cliente del backend: login, logout, authFetch (llamadas protegidas), filasDe()
      session.tsx            Sesión, vencimiento del token, avisos y el ID_FACILITADOR global
      facilitador.ts         ID_FACILITADOR del usuario logueado (GET mi-facilitador)
      guard.tsx              RequiereSesion: protege todas las pantallas de (app)/
      recordar.ts            "Recordar usuario y contraseña"
    evaluaciones.ts          Evaluaciones: lectura de GET mis-evaluaciones
    agenda.ts                Mis horarios: lectura de GET mi-agenda (V_AGENDA)
    intervenciones.ts        Marcar: listas en cascada, validaciones y guardado (mis-intervenciones)
    ubicacion.ts             GPS del dispositivo (expo-location)
    fechas.ts                Fechas en español a partir de la fecha actual (hoy, semana, meses)
    theme.ts                 6 temas de color × modo claro/oscuro, tipografía y puntos de quiebre
    theme-provider.tsx       Tema activo, preferencia guardada en el dispositivo y makeStyles()
    toast.tsx                Avisos breves ("Bienvenido", "Tu sesión se cerró")
    ui.tsx                   Componentes base (Text, Button, Badge, Field, Modal…)
    shell.tsx                Menú y navegación responsive
    data.ts / provider.tsx   Datos y estado de demostración (pantallas aún no conectadas)
    screens/                 Pantallas
sql/                         Backend (Oracle APEX / ORDS): scripts y contrato → sql/README.md
public/                      Plantilla web, manifest e íconos de la PWA
assets/                      Íconos de la app e imágenes
__tests__/                   Tests
```

## Login y sesión

- Se entra con un **usuario del workspace APEX** y su contraseña. El backend devuelve un token que dura **6 horas** y no se renueva.
- El token vive **solo en memoria**: al cerrar la app, o recargar la PWA, se vuelve al login. Es a propósito.
- Hay **un solo token activo por usuario**, compartido con el sistema APEX anterior: entrar en uno cierra la sesión en el otro.
- **Recordar usuario y contraseña** es opcional. Se guarda solo después de un login correcto: en el APK, en el almacenamiento seguro del sistema (Keystore/Keychain); en la PWA, en `localStorage`, donde la contraseña queda en texto plano. Destildar el check y entrar lo borra.
- Si el token vence o el backend lo invalida, aparece **un solo** aviso "Tu sesión se cerró" y la app vuelve al login. Sin señal, la sesión no se cierra: se muestra "Sin conexión con el servidor".
- Toda llamada nueva al backend tiene que usar `authFetch` de `src/facilitadores/auth/api.ts`.

## Datos de cada facilitador

Los registros de un facilitador **nunca se mezclan** con los de otro:

- Al entrar, la app pide al servidor `GET mi-facilitador`, que calcula el `ID_FACILITADOR` a partir del token, igual que las páginas APEX (`FACILITADORES.USUARIO = :APP_USER`). Queda como valor global de la sesión: `useSession().facilitador`.
- Los endpoints del facilitador (`mis-evaluaciones`…) también sacan el id **del token, en el servidor**. La app nunca manda el id de nadie, así que modificar la URL no da acceso a datos ajenos.
- Si el usuario no está en `FACILITADORES`, no se piden datos y se muestra "no está registrado como facilitador" (equivale al `NO_DATA_FOUND` de APEX).
- Al cerrar sesión o entrar con otro usuario, el id se vuelve a calcular.

## Modernización de las páginas APEX

| Página APEX | Pantalla | Endpoints | Script del backend |
|---|---|---|---|
| 11 · Evaluaciones | `/evaluaciones` (menú **Evaluaciones**) | `GET mi-facilitador`, `GET mis-evaluaciones` | [sql/facilitador_app_ethos.sql](sql/facilitador_app_ethos.sql) |
| 3 · Agenda | `/horarios` (menú **Mis horarios**) | `GET mi-agenda` | [sql/agenda_app_ethos.sql](sql/agenda_app_ethos.sql) |
| 2 · Intervención | `/marcar` (botón **Marcar** y menú **Registrar intervención**) | `GET mis-intervenciones/inicio · horarios · clase · indices`, `POST mis-intervenciones` | [sql/intervenciones_app_ethos.sql](sql/intervenciones_app_ethos.sql) |

### Mis horarios (página 3)

Mismo reporte que APEX (`V_AGENDA` del usuario, activas, año lectivo actual, mismo orden), en dos vistas:

- **Por día:** la semana actual con "HOY" resaltado y la cantidad de clases de cada día. Cada clase muestra horario, turno, grado y sección, institución, profesor, ciudad, manual (con su color) y énfasis. Las de hoy tienen el botón **Marcar**.
- **Semana completa:** todas las filas, con los días y horarios de cada una.

### Marcar (página 2)

El formulario respeta el orden, los selects y las validaciones de la página APEX, en 5 pasos: **¿Dónde?** (institución, horario) → **Clase** (grado, sección, turno, énfasis) → **Contenido** (manual, índice) → **¿Desarrolló la clase?** (Sí/No, motivo) → **Observación**.

- **Cascada:** cada cambio recarga solo las listas que dependen de él. Las listas sin opción vacía toman la primera opción; la institución y el índice usan el valor por defecto de la página, sin cambios.
- **Validaciones:** campos obligatorios; el motivo es obligatorio con "No" (`TRG_INTERV_SINO_MOTIVO`); la observación es obligatoria con "No" + "Otros" (validación `OBS`). El servidor vuelve a validar todo, incluido que cada valor esté en su lista y que la postulación sea del facilitador del token.
- **Ubicación:** se pide al abrir, como `PosicionActual`. Es obligatoria salvo que `FACILITADORES.IND_UBICACION_POSTULACION = 'NO'`, en cuyo caso el trigger `TRG_INTERV_UBICACION` la guarda en 0.
- **Lo que pone la base:** `FECHA_HORA`, `ANIO`, `ID_AUDITORIA` y el cierre de la postulación los siguen cargando los triggers de `INTERVENCIONES`.
- **Manuales:** se muestran con los colores de la página (SER rojo, HACER verde, TENER violeta…).

Cómo se porta una página:

1. **Exportación:** se toma la exportación de la página APEX (SQL de las regiones, ítems, acciones dinámicas).
2. **Endpoint:** si un endpoint publicado de `ethos` ya devuelve lo que la página necesita, se usa ese. Si no, se agrega uno al paquete `PKG_FACILITADOR_APP_ETHOS` con la **misma consulta** de la página y el `ID_FACILITADOR` sacado del token, y se publica con un script en `sql/`.
3. **Pantalla:** va en `src/app/(app)/` y se suma al menú en `shell.tsx`. Si falta una tabla o la forma de una respuesta, se pide antes de escribir código.

## Diseño responsive

- **Menos de 800 px de ancho** (celulares): barra superior, y barra inferior con **Inicio · Marcar · Menú · Perfil · Salir**.
  - **Menú** abre un panel con **todas** las secciones (Inicio, Registrar intervención, Mis horarios, Mis materiales, Evaluaciones, Mi perfil) y el Centro de ayuda. Las secciones nuevas aparecen ahí solas.
  - **Salir** pide confirmación antes de cerrar la sesión.
- **800 px o más** (tablets, escritorio, web): menú lateral fijo, y en Inicio la columna de calendario y accesos rápidos.
- En Perfil → **Apariencia**: modo claro / oscuro / automático y 6 temas de color.

## Solución de problemas

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `ords/%3Cesquema%3E/...` o "blocked by CORS policy" en el navegador | El servidor de desarrollo sigue con una URL vieja, o la ruta no existe (404 sin encabezados CORS) | `npx expo start --clear`. ORDS ya maneja CORS: no hace falta configurarlo. |
| Evaluaciones: "Falta publicar en el backend el endpoint mi-facilitador" | No se corrió `sql/facilitador_app_ethos.sql` | Correrlo en APEX (ver [sql/README.md](sql/README.md)) |
| Mis horarios: "Falta publicar en el backend el endpoint mi-agenda" | No se corrió `sql/agenda_app_ethos.sql` | Correrlo en APEX |
| Marcar: "Falta publicar en el backend los endpoints de mis-intervenciones" | No se corrió `sql/intervenciones_app_ethos.sql` | Correrlo en APEX |
| Marcar: "Permití el acceso a la ubicación" | El navegador o el celular no dio permiso de ubicación | Habilitar la ubicación para la app y tocar **Reintentar** |
| Evaluaciones: "Tu usuario (X) no está registrado como facilitador" | El usuario no tiene fila en `FACILITADORES` | Revisar `FACILITADORES.USUARIO` en APEX |
| "Tu sesión se cerró" sin haber salido | Venció el token (6 h) o el usuario entró en el sistema APEX anterior | Volver a iniciar sesión |

## Instalación en celulares

### Android: APK

El APK se compila en la nube con EAS Build. Requiere una cuenta gratuita de Expo.

```sh
npx eas-cli@latest login
npm run build:apk
```

Al terminar, EAS entrega un link y un código QR para descargar el `.apk` e instalarlo en el celular. Hay que permitir "instalar apps de origen desconocido". El perfil está en `eas.json` → `apk`.

### iOS: PWA

En iPhone la app se instala como PWA (aplicación web) desde Safari:

```sh
npm run build:pwa   # genera la carpeta dist/
```

1. Publicá la carpeta `dist/` en un hosting con **HTTPS**, por ejemplo `npx eas-cli@latest deploy` (EAS Hosting), Netlify o Vercel. Configurá el hosting para que todas las rutas devuelvan `index.html`.
2. En el iPhone, abrí la URL en **Safari** → botón Compartir → **Agregar a pantalla de inicio**.

El ícono, el nombre y la pantalla completa salen de `public/manifest.json`, `public/apple-touch-icon.png` y `public/index.html`.

### Logo e íconos

El logo original está en `public/logo.png`. A partir de él se generaron:

- `assets/icon.png`: ícono de la app
- `assets/android-icon-*.png`: ícono adaptativo de Android
- `assets/splash-icon.png`: pantalla de carga
- `public/logo192.png`, `public/logo512.png`, `public/logo-maskable.png`, `public/apple-touch-icon.png` y `favicon.png`: íconos de la PWA
- `assets/images/logo.png`: logo dentro de la app

Las carpetas `ios/` y `android/` se generan automáticamente y no se versionan.
