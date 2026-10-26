# Facilitadores

App para facilitadores educativos: marcar entrada a las clases (con ubicación), organizar horarios, gestionar los manuales e índices desarrollados por grado e institución, ver sus evaluaciones y administrar el perfil.

Es la **modernización de la app Oracle APEX 193573 "Facilitadores"**: cada página de APEX se pasa a una pantalla de esta app y usa el mismo backend.

Está hecha con **React Native + Expo**. Una sola base de código funciona en **Android (APK)**, **iOS (PWA)** y web; la web usa `react-native-web`.

| Parte | Estado |
|---|---|
| Login y sesión | Conectado al backend (ORDS, módulo `ethos`) |
| Evaluaciones (página 11 de APEX) | Conectada: requiere publicar [sql/facilitador_app_ethos.sql](sql/facilitador_app_ethos.sql) |
| Marcar / Registrar intervención (página 2 de APEX) | Conectada, con ubicación real del GPS: requiere publicar [sql/intervenciones_app_ethos.sql](sql/intervenciones_app_ethos.sql) |
| Inicio | Conectado: los 4 KPIs (**Clases esta semana**, **Marcaciones del mes**, **Materiales desarrollados**, **Instituciones**), **Tus clases de hoy** y **Actividad reciente** |
| Mi agenda (página 3 de APEX) | Conectada, con el **próximo índice** de cada clase y vista **Línea de tiempo**: requiere publicar [sql/agenda_app_ethos.sql](sql/agenda_app_ethos.sql) |
| Intervenciones realizadas (páginas 4, 5 y 6 de APEX) | Conectada: instituciones, clases con sus días e historial, con contadores: requiere publicar [sql/intervenciones_realizadas_app_ethos.sql](sql/intervenciones_realizadas_app_ethos.sql) |
| Historial de intervenciones (páginas 7 y 8 de APEX) | Conectado: búsqueda, filtros por mes y fecha, y edición: requiere publicar [sql/historial_app_ethos.sql](sql/historial_app_ethos.sql) |
| Mis materiales | Conectada: manuales e índices **desarrollados y pendientes**: requiere publicar [sql/materiales_app_ethos.sql](sql/materiales_app_ethos.sql) |
| Formularios (Form. 1, 2 y 3) | Conectada: PDF e imagen con **solo las clases del facilitador**: requiere publicar [sql/formularios_app_ethos.sql](sql/formularios_app_ethos.sql) |
| Perfil | Datos del usuario logueado y **foto de perfil**; la foto, el modo claro/oscuro y el tema de color se guardan en el dispositivo |
| Notificaciones (campana) | Conectada: **próxima clase** según la hora actual, con institución y próximo índice (sale de `mi-agenda`) |

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
    (app)/horarios.tsx       /horarios      (página 3 de APEX: Mi agenda)
    (app)/materiales.tsx     /materiales    (Mis materiales)
    (app)/intervenciones.tsx /intervenciones (páginas 4, 5 y 6 de APEX: Intervenciones realizadas)
    (app)/historial.tsx      /historial     (páginas 7 y 8 de APEX: Historial de intervenciones)
    (app)/evaluaciones.tsx   /evaluaciones  (página 11 de APEX)
    (app)/formularios.tsx    /formularios   (Form. 1, 2 y 3 en PDF e imagen)
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
    agenda.ts                Mi agenda: lectura de GET mi-agenda (V_AGENDA + próximo índice)
    clase-agenda.tsx         Tarjeta de clase (Mi agenda y "Tus clases de hoy") con el próximo índice
    cumpleanios.tsx          Inicio: cumpleaños del día (GET cumpleanios-hoy)
    grafico-semanal.tsx      Inicio: gráfico de intervenciones por semana (GET mis-intervenciones/por-dia)
    ayuda.tsx / manual.ts    Perfil → Ayuda: el manual de uso (manual.ts se genera desde docs/manual-usuario.md)
    proxima-clase.tsx        Campana de notificaciones: próxima clase según la hora actual
    linea-tiempo.tsx         Vista "Línea de tiempo" de Mi agenda
    materiales.ts            Mis materiales: lectura de GET mis-materiales
    realizadas.ts            Intervenciones realizadas: GET intervenciones-realizadas/*
    historial.ts             Historial de intervenciones: GET/PUT historial-intervenciones*
    editar-intervencion.tsx  Hoja "Editar intervención" (página 8)
    formularios/             Form. 1, 2 y 3: datos (GET mis-formularios/*), dibujo, PDF (jsPDF) e imagen (SVG)
    intervenciones.ts        Marcar: listas en cascada, validaciones y guardado (mis-intervenciones)
    ubicacion.ts             GPS del dispositivo (expo-location)
    foto-perfil.ts           Foto de perfil: galería, recorte a 256 px y guardado en el dispositivo
    fechas.ts                Fechas en español a partir de la fecha actual (hoy, semana, meses)
    theme.ts                 6 temas de color × modo claro/oscuro, tipografía y puntos de quiebre
    theme-provider.tsx       Tema activo, preferencia guardada en el dispositivo y makeStyles()
    toast.tsx                Avisos breves ("Bienvenido", "Tu sesión se cerró")
    ui.tsx                   Componentes base (Text, Button, Badge, Field, Modal, Avatar, AvatarAureola…)
    shell.tsx                Menú y navegación responsive
    data.ts / provider.tsx   Datos y estado de demostración (pantallas aún no conectadas) y la foto de perfil
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
| 3 · Agenda | `/horarios` (menú **Mi agenda**) | `GET mi-agenda` | [sql/agenda_app_ethos.sql](sql/agenda_app_ethos.sql) |
| — · Mis materiales | `/materiales` (menú **Mis materiales**) | `GET mis-materiales` | [sql/materiales_app_ethos.sql](sql/materiales_app_ethos.sql) |
| — · Inicio (KPIs y actividad) | `/` | `GET mi-agenda`, `GET mis-intervenciones/resumen`, `GET mis-intervenciones/recientes` | agenda + intervenciones |
| 2 · Intervención | `/marcar` (botón **Marcar** y menú **Registrar intervención**) | `GET mis-intervenciones/inicio · horarios · clase · indices`, `POST mis-intervenciones` | [sql/intervenciones_app_ethos.sql](sql/intervenciones_app_ethos.sql) |
| 4 · Intervenciones, 5 · Días, 6 · Manuales | `/intervenciones` (menú **Intervenciones realizadas**) | `GET intervenciones-realizadas/instituciones · clases · historial` | [sql/intervenciones_realizadas_app_ethos.sql](sql/intervenciones_realizadas_app_ethos.sql) |
| — · Formularios 1, 2 y 3 (del sitio editorial-ethos-app) | `/formularios` (menú **Formularios**) | `GET mis-formularios/postulaciones · institucion · intervenciones · bloqueos` | [sql/formularios_app_ethos.sql](sql/formularios_app_ethos.sql) |
| 7 · Historial de Intervenciones, 8 · Observación | `/historial` (menú **Historial de intervenciones**) y **Editar** en Intervenciones realizadas | `GET historial-intervenciones`, `GET` / `PUT historial-intervenciones/:id` | [sql/historial_app_ethos.sql](sql/historial_app_ethos.sql) |

### Formularios (Form. 1, 2 y 3)

Los tres formularios del sitio **editorial-ethos-app** (ver `GUIA_FORMULARIOS.md` de ese repo), en **PDF** e **imagen PNG**, con el mismo formato y las mismas reglas, pero **solo con los datos del facilitador logueado**: el servidor saca el `ID_FACILITADOR` del token (`PKG_FORMULARIOS_APP_ETHOS`) y nunca devuelve postulaciones, intervenciones ni bloqueos de otro.

| Formulario | Qué muestra | Parámetros |
|---|---|---|
| **Form. 1** · Postulación anual | Cabecera, autoridades y horario de la institución, y **solo las clases del facilitador** en ella (activas), por turno con subtotal y total | Año lectivo e institución (solo aquellas donde tiene clases ese año) |
| **Form. 2** · Reporte diario | Sus clases en la institución (secciones juntas), con las intervenciones 1° a 4° del período, 1/0, motivo y TOTAL | Año, institución y un mes o una etapa (tabla `ETAPAS`) |
| **Form. 3** · Agenda semanal | Su semana de mañana y tarde en todas sus instituciones, con lo bloqueado (`FACILITADORES_DIAS_BLOQUEOS`) en rojo | Año lectivo |

- Salen de **postulaciones** (no de pre-horarios), las activas (`NVL(ESTADO,'Activo') <> 'Inactivo'`). Sin Excel.
- **Un dibujo, dos salidas**: cada formulario se dibuja una vez contra un "pintor" (`src/facilitadores/formularios/pintor.ts`). El PDF sale con jsPDF (oficio apaisado; el Form. 1 pagina, el 2 y el 3 van en una hoja) y la vista previa con react-native-svg. La imagen es esa misma vista: en el APK con `Svg.toDataURL`, en la web pasando el SVG por un `<canvas>`. El texto se mide con la Helvetica de jsPDF en las dos salidas, así cortan igual.
- **APK**: el archivo se guarda en la caché y se abre el menú de compartir (`expo-sharing`). **Web/PWA**: se abre en una pestaña nueva, o se descarga si el navegador la bloquea.
- Los textos fijos (declaración, nota, contacto, misión, coordinación nacional) están en `form1.ts` y `form2.ts`, igual que en el sitio. Los colores de los manuales salen de `COLOR_MANUAL`.
- `expo-sharing` es un módulo nativo: hace falta un **APK nuevo**.

### Historial de intervenciones (páginas 7 y 8)

- **Buscador** (fecha, manual, observación, Sí/No, institución, grado, énfasis) y facetas **Mes** (arranca en el mes actual, como APEX) y **Fecha** (días del mes con su cantidad). **Restablecer** vuelve al mes actual.
- Intervenciones agrupadas por día, con hora, Sí/No, manual (color), índice, institución, grado, turno, énfasis, motivo y observación; de a 50 con **Ver más**.
- **Editar** (página 8) abre una hoja encima: el manual es solo lectura; se cambia el índice (los del manual, con buscador), ¿Desarrolló? Sí/No, el motivo (solo con "No"; como en APEX, al pasar a "Sí" el motivo guardado no se borra) y la observación (hasta 1000). Con "No" + "Otros" la observación es obligatoria (validación `OBS`). Al guardar se refresca la lista. El mismo formulario se abre desde el historial de **Intervenciones realizadas**.
- Solo se pueden editar intervenciones propias del año lectivo actual (lo controla el servidor).

### Intervenciones realizadas (páginas 4, 5 y 6)

Los tres modales de APEX (institución → días → historial) quedan en una sola pantalla, con las mismas consultas:

- **Instituciones (página 4):** tus instituciones del año lectivo, con las marcaciones y el % desarrolladas ("Sí") de cada una. Con más de 5 aparece un buscador.
- **Clases (página 5):** una tarjeta por clase (grado, sección y turno) en lugar de una fila por día: muestra el énfasis, los días **L M X J V** en que marcaste y sus contadores. Ordenadas por turno, grado y sección.
- **Historial (página 6):** las intervenciones de la clase agrupadas por mes, de la más nueva a la más vieja, con ✓/✗, manual (con su color), índice y observación. Filtros Todas / Desarrolladas / No desarrolladas y por manual; de a 15, con **Ver más**.
- **Navegación:** en el celular se avanza por pasos y se vuelve con la miga de pan (Instituciones › Institución › Clase). En escritorio las instituciones quedan a la izquierda, con la primera elegida, y el detalle a la derecha.

### Inicio

| KPI / sección | De dónde sale |
|---|---|
| Intervenciones por semana (gráfico, encima de los KPIs) | `mis-intervenciones/por-dia`: una fila por día del año lectivo con total, Sí y No del facilitador. Se pide una vez y los filtros de mes y semana se aplican en la app. Barras agrupadas por día (lunes a viernes; sábado y domingo solo si hubo intervenciones), leyenda con los totales de la semana, lectura del día tocado y **Ver tabla**. Colores: `colors.chart` (azul / aguamarina / naranja, iguales en todos los temas y validados para daltonismo) |
| Cumpleaños del día | `cumpleanios-hoy`: tarjeta "🎂 ¡Hoy celebramos!" con los facilitadores que cumplen hoy (solo el nombre). Si el cumpleañero es el usuario, aparece aparte "🎉 ¡Feliz cumpleaños, …!" con su foto. Si nadie cumple, no se muestra nada |
| Foto con aureola (junto al saludo) | La foto de perfil guardada en el dispositivo (o las iniciales), con un anillo degradé de los colores del tema que gira lento y un brillo suave. Queda quieta si el sistema tiene "reducir movimiento". Al tocarla se abre Perfil |
| Clases esta semana | Días con horario de cada fila de la agenda (`mi-agenda`); abajo, las de hoy |
| Marcaciones del mes | Intervenciones del mes actual (hora de Paraguay); abajo, cuántas fueron "Sí" |
| Materiales desarrollados | Índices desarrollados hasta la fecha; abajo, manuales completos (postulaciones `Finalizado`) |
| Instituciones | Instituciones distintas en tus postulaciones del año lectivo actual |
| Frase del día (portada) | Una de las 100 frases de [docs/frases-docentes.md](docs/frases-docentes.md), distinta cada día en orden aleatorio, sin repetir hasta haber mostrado las 100 (después se mezclan de nuevo). Si editás el `.md`, corré `npm run frases` para regenerar `src/facilitadores/frases.ts` |
| Tus clases de hoy | La agenda del día, con el próximo índice y el botón **Marcar** |
| Actividad reciente | Tus últimas 5 intervenciones |

### Notificaciones (campana)

La campana de la barra superior muestra **tu próxima clase**, calculada con la agenda (`mi-agenda`) y la hora actual:

- **Cuál:** la primera clase de hoy que todavía no empezó. Si hoy no queda ninguna, la primera del siguiente día con clases (busca hasta una semana). Se recalcula cada minuto.
- **Qué muestra:** cuándo ("Hoy · en 25 min", "Mañana" o la fecha), el horario, la institución con grado, sección y turno, el manual con el **próximo índice** (o "completado") y el botón **Ver mi agenda**.
- **Punto de "nueva":** aparece cuando hay una próxima clase sin ver y se apaga al abrir la campana. Vuelve a aparecer cuando la próxima clase cambia (empezó la anterior, cambió el día o la agenda). Lo visto se recuerda solo en memoria: al volver a entrar, el punto aparece otra vez.
- Si el usuario no es facilitador no se pide nada, igual que en el resto de las pantallas.

### Perfil

- **Datos personales:** nombre, usuario y correo del login, solo lectura.
- **Foto de perfil:** se toca el avatar o **Cargar foto / Cambiar foto**, y **Quitar** para volver a las iniciales. Se elige de la galería (`expo-image-picker`), se recorta en cuadrado y se achica a 256 px en JPEG (`expo-image-manipulator`) para no llenar el almacenamiento.
  - Se guarda **solo en este dispositivo**: `localStorage` en la PWA y almacenamiento local en el APK, con una clave por usuario (`facilitadores.foto.<USUARIO>`). No se sube al backend ni aparece en otro equipo.
  - Se muestra en el saludo de Inicio (con la aureola), en el menú lateral de escritorio y en el panel **Menú** del celular.
  - En la PWA no hay editor de recorte: se toma el cuadrado central. En Android e iOS aparece el editor.
- **Apariencia:** modo claro / oscuro / automático y 6 temas de color, también guardados en el dispositivo.
- **Ayuda:** el manual de uso, con un capítulo desplegable por tema. También se llega desde **Centro de ayuda** → **Ver el manual de uso**.
  - El texto está en [docs/manual-usuario.md](docs/manual-usuario.md). Después de editarlo, corré `npm run manual` para regenerar `src/facilitadores/manual.ts`, porque la app no lee archivos `.md`.
  - Formato admitido: `## ` capítulo, `### ` subtítulo, `- ` viñeta, `1. ` paso, `> ` consejo y `**negrita**`.

### Mi agenda (página 3)

Mismo reporte que APEX (`V_AGENDA` del usuario, activas, año lectivo actual, mismo orden), en tres vistas:

- **Por día:** la semana actual con "HOY" resaltado y la cantidad de clases de cada día. Cada clase muestra horario, turno, grado y sección, institución, profesor, ciudad, manual (con su color), énfasis y el **próximo índice** (el siguiente al último desarrollado) con su avance ("3 de 12"), o "Manual completado". Las de hoy tienen el botón **Marcar**.
- **Línea de tiempo:** el día como una columna de horas, con un bloque por clase del color de su manual, separadores de Mañana y Tarde, y una línea roja con la hora actual cuando el día es hoy.
- **Semana:** todas las filas, con los días y horarios de cada una.

### Mis materiales

Cada manual de tus postulaciones del año lectivo (también las finalizadas) con **todos sus índices**:

- **Resumen:** índices desarrollados, pendientes y manuales completos, con el avance general.
- **Filtros:** Todos / En curso / Completos, y por manual (con su color).
- **Tarjeta por manual:** grado, turno, institución, avance ("3 de 12") y próximo índice.
- **Ver índices:** despliega la lista con ✓ desarrollado (con fecha), ○ pendiente, y el **próximo** resaltado con el botón **Marcar**.
- **Descargar/Compartir:** exporta el índice con su estado.

### Colores de los manuales

Una sola constante (`COLOR_MANUAL` en `src/facilitadores/intervenciones.ts`) con los colores del sistema APEX, usada en todas las pantallas:

| Manual | Color | Código |
|---|---|---|
| Ser | rojo | `#e74c3c` |
| Hacer | verde | `#27ae60` |
| Tener | lila | `#c39bd3` |
| Carácter | gris | `#a6a6a6` |
| Visión | amarillo | `#f9e54e` |
| Coraje | celeste | `#3498db` |
| Liderazgo | rojo | `#e74c3c` |

### Marcar (página 2)

El formulario respeta el orden, los selects y las validaciones de la página APEX, en 5 pasos: **¿Dónde?** (institución, horario) → **Clase** (grado, sección, turno, énfasis) → **Contenido** (manual, índice) → **¿Desarrolló la clase?** (Sí/No, motivo) → **Observación**.

- **Cascada:** cada cambio recarga solo las listas que dependen de él. Las listas sin opción vacía toman la primera opción; la institución y el índice usan el valor por defecto de la página, sin cambios.
- **Validaciones:** campos obligatorios; el motivo es obligatorio con "No" (`TRG_INTERV_SINO_MOTIVO`); la observación es obligatoria con "No" + "Otros" (validación `OBS`). El servidor vuelve a validar todo, incluido que cada valor esté en su lista y que la postulación sea del facilitador del token.
- **Ubicación:** se pide al abrir, como `PosicionActual`. Es obligatoria salvo que `FACILITADORES.IND_UBICACION_POSTULACION = 'NO'`, en cuyo caso el trigger `TRG_INTERV_UBICACION` la guarda en 0.
  - Es más exacta que en APEX, que no pedía alta precisión. Se usa el GPS a máxima precisión (`Accuracy.BestForNavigation`). En Android, si el GPS está apagado, ofrece activarlo.
  - **Facilitadores que no requieren ubicación** (`IND_UBICACION_POSTULACION` = `N`, `No` o `NO`): la app no pide permiso ni enciende el GPS, y el servidor guarda latitud y longitud en 0, como la página 2.
  - La posición se afina **en segundo plano** mientras el facilitador completa el formulario, sin mostrarle nada. Solo aparece un aviso si falta el permiso o el GPS.
  - Se sigue escuchando hasta lograr ±5 m o hasta 3 minutos, quedándose siempre con la de menor error. Al guardar se envía la mejor obtenida hasta ese momento.
  - Se descartan las posiciones viejas que el sistema tenía guardadas. Las coordenadas se envían con todos sus decimales y el backend las guarda sin redondear.
  - Lógica en [src/facilitadores/ubicacion.ts](src/facilitadores/ubicacion.ts).
- **Lo que pone la base:** `FECHA_HORA`, `ANIO`, `ID_AUDITORIA` y el cierre de la postulación los siguen cargando los triggers de `INTERVENCIONES`.
- **Manuales:** se muestran con los colores de la página (SER rojo, HACER verde, TENER violeta…).

Cómo se porta una página:

1. **Exportación:** se toma la exportación de la página APEX (SQL de las regiones, ítems, acciones dinámicas).
2. **Endpoint:** si un endpoint publicado de `ethos` ya devuelve lo que la página necesita, se usa ese. Si no, se agrega uno al paquete `PKG_FACILITADOR_APP_ETHOS` con la **misma consulta** de la página y el `ID_FACILITADOR` sacado del token, y se publica con un script en `sql/`.
3. **Pantalla:** va en `src/app/(app)/` y se suma al menú en `shell.tsx`. Si falta una tabla o la forma de una respuesta, se pide antes de escribir código.

## Diseño responsive

- **Barra superior:** título de la sección y la campana de notificaciones (sin avatar; la foto está en Inicio, el menú y Perfil).
- **Menos de 800 px de ancho** (celulares): barra superior, y barra inferior con **Inicio · Marcar · Menú · Perfil · Salir**.
  - **Menú** abre un panel con **todas** las secciones (Inicio, Registrar intervención, Intervenciones realizadas, Historial de intervenciones, Mi agenda, Mis materiales, Evaluaciones, Formularios, Mi perfil) y el Centro de ayuda. Las secciones nuevas aparecen ahí solas.
  - **Salir** pide confirmación antes de cerrar la sesión.
- **800 px o más** (tablets, escritorio, web): menú lateral fijo, y en Inicio la columna de calendario y accesos rápidos.
- En Perfil → **Apariencia**: modo claro / oscuro / automático y 6 temas de color. También ahí se carga la foto de perfil.

## Solución de problemas

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `ords/%3Cesquema%3E/...` o "blocked by CORS policy" en el navegador | El servidor de desarrollo sigue con una URL vieja, o la ruta no existe (404 sin encabezados CORS) | `npx expo start --clear`. ORDS ya maneja CORS: no hace falta configurarlo. |
| APK: "Sin conexión con el servidor" aunque la web funcione en el mismo celular | El filtro anti-bots de oracleapex.com deja sin respuesta a las llamadas que se identifican como `okhttp`, que es el valor por defecto de Android | Ya está resuelto en `api.ts`, que manda `User-Agent: Facilitadores/<versión> (Android)`. Hace falta un APK generado después de ese cambio |
| Evaluaciones: "Falta publicar en el backend el endpoint mi-facilitador" | No se corrió `sql/facilitador_app_ethos.sql` | Correrlo en APEX (ver [sql/README.md](sql/README.md)) |
| Mi agenda: "Falta publicar en el backend el endpoint mi-agenda" | No se corrió `sql/agenda_app_ethos.sql` | Correrlo en APEX |
| Historial / Editar: "Falta publicar en el backend los endpoints de historial-intervenciones" | No se corrió `sql/historial_app_ethos.sql` | Correrlo en APEX |
| Intervenciones realizadas: "Falta publicar en el backend los endpoints de intervenciones-realizadas" | No se corrió `sql/intervenciones_realizadas_app_ethos.sql` | Correrlo en APEX |
| Mis materiales: "Falta publicar en el backend el endpoint mis-materiales" | No se corrió `sql/materiales_app_ethos.sql` | Correrlo en APEX |
| Formularios: "Falta publicar en el backend los endpoints de mis-formularios" | No se corrió `sql/formularios_app_ethos.sql` | Correrlo en APEX |
| Formularios (APK): PDF o Imagen no abren nada | APK anterior a `expo-sharing` | Instalar un APK nuevo |
| Inicio: un KPI dice "Falta publicar mis-intervenciones" | No se corrió (o no se volvió a correr) `sql/intervenciones_app_ethos.sql` | Correrlo en APEX |
| Marcar: "Falta publicar en el backend los endpoints de mis-intervenciones" | No se corrió `sql/intervenciones_app_ethos.sql` | Correrlo en APEX |
| Marcar: "Permití el acceso a la ubicación" | El navegador o el celular no dio permiso de ubicación | Habilitar la ubicación para la app y tocar **Reintentar** |
| Evaluaciones: "Tu usuario (X) no está registrado como facilitador" | El usuario no tiene fila en `FACILITADORES` | Revisar `FACILITADORES.USUARIO` en APEX |
| "Tu sesión se cerró" sin haber salido | Venció el token (6 h) o el usuario entró en el sistema APEX anterior | Volver a iniciar sesión |

## Instalación en celulares

### Android: APK

**Automático (GitHub Actions):** cada push a `main` o `react-native` compila el APK ([.github/workflows/apk.yml](.github/workflows/apk.yml)) y lo publica en el release `apk-latest`. Se reemplaza el del commit anterior, así que siempre hay uno solo, el del último commit, y la URL no cambia:

```
https://github.com/josegalvez1985/facilitador-hub/releases/download/apk-latest/facilitadores.apk
```

- Los cambios que solo tocan `.md`, `sql/`, `docs/` o `__tests__/` no compilan. También se puede correr a mano desde la pestaña **Actions** → **APK** → **Run workflow**.
- El `versionCode` es el número de corrida, así Android acepta instalarlo encima del anterior. La versión visible sigue siendo `version` de `app.json`.
- Está firmado con la clave de depuración de la plantilla de Expo, igual en cada corrida. El workflow verifica la firma antes de publicar: si cambiara, el celular obligaría a desinstalar.
- En GitHub, **Settings → General → Releases → Immutable releases** tiene que estar apagada; si no, no se puede reemplazar el APK.
- Si el repositorio es privado, la descarga pide iniciar sesión en GitHub.

**Manual (EAS Build):** el APK se compila en la nube de Expo. Requiere una cuenta gratuita de Expo.

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
