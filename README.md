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
| Formularios (Form. 1, 2 y 3 y Acuerdo de cooperación) | Conectada: PDF e imagen con **solo las clases del facilitador**; el Acuerdo, solo en PDF (ver y descargar) y solo de sus instituciones: requiere publicar [sql/formularios_app_ethos.sql](sql/formularios_app_ethos.sql) |
| Mis facturas | Conectada: el facilitador **saca o elige la foto** de su factura (va a Cloudinary), carga **número, timbrado, fecha** (en un calendario) y **mes**, y ve, corrige o borra las que están por revisar: requiere publicar [sql/facturas_app_ethos.sql](sql/facturas_app_ethos.sql) y un **APK nuevo** (permiso de cámara) |
| Mi postulación | Conectada: formulario por pasos para postularse al año lectivo (`POSTULANTES_FACILITADORES`), con los datos de otro año para precargar, **documentos obligatorios** (foto o PDF, a Cloudinary), resumen y corrección: requiere publicar [sql/postulacion_app_ethos.sql](sql/postulacion_app_ethos.sql) y un **APK nuevo** (selector de PDF) |
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
    (app)/facturas.tsx       /facturas      (Mis facturas: foto y datos de la factura del mes)
    (app)/postulacion.tsx    /postulacion   (Mi postulación al año lectivo)
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
    facturas.ts              Mis facturas: mis-facturas/*, la foto (cámara o galería), la subida a Cloudinary y el formato del número
    editar-factura.tsx       Formulario de alta / corrección de una factura
    postulacion.ts           Mi postulación: mi-postulacion/*, opciones, validación por paso y borrador en memoria
    postulacion-form.tsx     Formulario por pasos de la postulación y su resumen
    selector-fecha.tsx       Campo de fecha que se elige en un calendario (sin módulo nativo)
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
- **Dónde vive la sesión:**
  - **Android (APK):** el token vive **solo en memoria**; al cerrar la app se vuelve al login.
  - **Navegador / PWA** (24/11/2026): la sesión se guarda también en el `localStorage` del sitio (`facilitadores.sesion`). Así **Actualizar** no saca al login y **varias pestañas** comparten la sesión.
    - Se borra al cerrar sesión, al vencer el token o con un 401, y se cierra en **todas** las pestañas (evento `storage`). Si en una pestaña se entra con otro usuario, las demás pasan a ese usuario.
    - Un token vencido guardado no se usa.
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
| — · Formularios 1, 2 y 3 (del sitio editorial-ethos-app) y Acuerdo de cooperación (modelo "7 MODELO ACUERDO IE") | `/formularios` (menú **Formularios**) | `GET mis-formularios/postulaciones · institucion · intervenciones · bloqueos` | [sql/formularios_app_ethos.sql](sql/formularios_app_ethos.sql) |
| — · Mis facturas (con "Totales por Facilitador" del sitio editorial-ethos-app) | `/facturas` (menú **Mis facturas**) | `GET` / `POST mis-facturas`, `PUT` / `DELETE mis-facturas/:id`, `POST mis-facturas/firma-foto` | [sql/facturas_app_ethos.sql](sql/facturas_app_ethos.sql) |
| — · Mi postulación (tabla `POSTULANTES_FACILITADORES`, formulario JV26) | `/postulacion` (menú **Mi postulación**) | `GET` / `POST mi-postulacion`, `GET mi-postulacion/lugares`, `DELETE mi-postulacion`, `POST mi-postulacion/firma-documento`, `DELETE mi-postulacion/documento` | [sql/postulacion_app_ethos.sql](sql/postulacion_app_ethos.sql) |
| 7 · Historial de Intervenciones, 8 · Observación | `/historial` (menú **Historial de intervenciones**) y **Editar** en Intervenciones realizadas | `GET historial-intervenciones`, `GET` / `PUT historial-intervenciones/:id` | [sql/historial_app_ethos.sql](sql/historial_app_ethos.sql) |

### Formularios (Form. 1, 2 y 3)

Los tres formularios del sitio **editorial-ethos-app** (ver `GUIA_FORMULARIOS.md` de ese repo), en **PDF** e **imagen PNG**, con el mismo formato y las mismas reglas, pero **solo con los datos del facilitador logueado**: el servidor saca el `ID_FACILITADOR` del token (`PKG_FORMULARIOS_APP_ETHOS`) y nunca devuelve postulaciones, intervenciones ni bloqueos de otro.

| Formulario | Qué muestra | Parámetros |
|---|---|---|
| **Form. 1** · Postulación anual | Cabecera, autoridades y horario de la institución, y **solo las clases del facilitador** en ella (activas), por turno con subtotal y total | Año lectivo e institución (solo aquellas donde tiene clases ese año) |
| **Form. 2** · Reporte diario | Sus clases en la institución (secciones juntas), con las intervenciones 1° a 4° del período, 1/0, motivo y TOTAL | Año, institución y un mes o una etapa (tabla `ETAPAS`) |
| **Form. 3** · Agenda semanal | Su semana de mañana y tarde en todas sus instituciones, con lo bloqueado (`FACILITADORES_DIAS_BLOQUEOS`) en rojo | Año lectivo |

- Salen de **postulaciones** (no de pre-horarios), las activas (`NVL(ESTADO,'Activo') <> 'Inactivo'`). Sin Excel.
- **Un dibujo, dos salidas**: cada formulario se dibuja una vez contra un "pintor" (`src/facilitadores/formularios/pintor.ts`). El PDF sale con jsPDF (oficio apaisado; el Form. 1 pagina, el 2 y el 3 van en una hoja) y la vista previa es el mismo dibujo en SVG. La imagen sale de ese SVG pasado por un `<canvas>`: en la web, en el navegador; en el APK, adentro de un **WebView** (`hoja-nativa.tsx`), que también muestra la vista previa (se amplía pellizcando). El texto se mide con la Helvetica de jsPDF en las dos salidas, así cortan igual.
- **Por qué un WebView en el APK:** react-native-svg dibuja en el hilo principal de Android (la vista previa y `Svg.toDataURL`, que además comprime el PNG ahí). Con una hoja de ~700 elementos la app quedaba "no responde" al tocar PDF o Imagen. El WebView trabaja en su propio proceso.
- **Logo:** `assets/images/logo-formularios.jpg` (200 px, copia de `public/logo.png` sobre blanco). jsPDF inserta un JPEG sin decodificarlo; con el PNG de 512 px el PDF del Form. 2 tardaba segundos en el APK y pesaba 1 MB.
- **APK**: el archivo se guarda en la caché y se abre el menú de compartir (`expo-sharing`). **Web/PWA**: se abre en una pestaña nueva, o se descarga si el navegador la bloquea.
- Los textos fijos (declaración, nota, contacto, misión, coordinación nacional) están en `form1.ts` y `form2.ts`, igual que en el sitio. Los colores de los manuales salen de `COLOR_MANUAL`.
- `expo-sharing` y `react-native-webview` son módulos nativos: hace falta un **APK nuevo**.

### Acuerdo de cooperación

La pestaña **Acuerdo** de Formularios arma el "Acuerdo específico de cooperación" entre la Editorial Ethos y una institución, igual al modelo `7 MODELO ACUERDO IE PDF.pdf` (A4 vertical, Times, dos hojas), en `src/facilitadores/formularios/acuerdo.ts`.

- **Solo PDF**: **Ver PDF** (web: pestaña nueva; APK: menú para elegir un visor) y **Descargar** (web: descarga del navegador; APK: el facilitador elige la carpeta con `Directory.pickDirectoryAsync` de `expo-file-system`). La vista previa es el mismo dibujo con las hojas una debajo de la otra.
- **Datos**: los de `GET mis-formularios/institucion` (no hace falta otro endpoint): el nombre de la institución y la primera autoridad del período con "director" en el cargo (nombre, CI y teléfono). Lo que falta sale como línea en blanco y la pantalla lo avisa. El año es el año lectivo elegido (artículos 1, 2, 16 y 17).
- **Solo sus instituciones**: la lista sale de las postulaciones activas del facilitador y el servidor responde 404 por cualquier otra institución.
- **Fijo, como en el modelo**: el texto de las cláusulas, Santiago Monti (CI 685944), Cecilia Rafael (0983-196085), "ASUNCIÓN, marzo de {año}" y la fecha del Convenio Marco con el MEC, que queda en blanco.
- **Imágenes**: `assets/images/logo-jv.jpg` (logo de Juventud con Valores) y `assets/images/firma-acuerdo.jpg` (firma "P/Autorización Cecilia Rafael"), sacadas del PDF del modelo.

### Mis facturas

El facilitador envía la **foto** y los **datos** de su factura de cada mes, y el administrador la controla desde **Totales por Facilitador** del sitio editorial-ethos-app. Es la misma tabla (`FACTURAS_FACILITADORES`) y son las mismas reglas. El servidor saca el `ID_FACILITADOR` del token y nunca devuelve cantidad, sueldo ni monto.

- **Lista:** las facturas del facilitador, de la más nueva a la más vieja, con la miniatura de la foto, el mes, el número, el timbrado, la fecha, cuándo se envió y su estado: **Por revisar** (`CANTIDAD = 0`) o **Revisada**. Tocando la miniatura se ve la foto en grande, y **Abrir original** abre el archivo.
- **Corregir / Borrar:** solo mientras está por revisar. Una revisada no se toca: el servidor responde 409.
- **Formulario** (`editar-factura.tsx`): va dentro de la pantalla y no en un modal, para que el `KeyboardAvoidingView` del shell evite que el teclado tape los campos.
  - **Foto**: obligatoria en el alta. Se saca con la cámara o se elige de la galería (`expo-image-picker`) y se achica a 2000 px como máximo, en JPEG (`expo-image-manipulator`).
  - **Número**: se acomoda mientras se escribe, con o sin guiones (`mascaraNroFactura`), y al salir del campo queda `001-001-0000123`.
  - **Timbrado**: opcional, solo números.
  - **Fecha**: se elige en un calendario (`selector-fecha.tsx`, React Native puro), entre el 01/01/2024 y hoy, con atajos **Hoy** y **Ayer**.
  - **Mes**: año y mes. Los meses futuros y los que ya tienen otra factura no se pueden elegir, y se propone el último mes sin factura.
- **Subida:** al tocar **Enviar**, la app pide `POST mis-facturas/firma-foto` (la firma vence en una hora), sube el archivo **directo a Cloudinary** (`pedirExterno` de `api.ts`, con el mismo User-Agent) y manda el `secure_url` como `foto_url`. Si el guardado falla, el reintento no vuelve a subir la foto. Sin lectura con IA (decisión del 04/11/2026).
- Si Cloudinary no está configurado en Oracle (`fotos_habilitadas: false`), no se puede cargar una factura nueva.
- **Cámara:** el permiso está en `app.json` (`expo-image-picker` → `cameraPermission`). Hace falta un **APK nuevo**.
- **Borrar la foto en Cloudinary:** al borrar una factura, o al cambiarle la foto, el servidor borra la foto vieja de Cloudinary después de guardar, con `PKG_CLOUDINARY_ETHOS.borrar`. Esa función viene en el `backend/cloudinary.sql` nuevo del sitio.
  - Si el paquete instalado en Oracle no la tiene, la factura se borra igual y la foto queda en Cloudinary. El script de la app lo avisa con `[WARN]`.
  - Para saber si está: `SELECT procedure_name FROM user_procedures WHERE object_name = 'PKG_CLOUDINARY_ETHOS'` tiene que listar **BORRAR**.
  - Correr el `cloudinary.sql` nuevo del sitio no pisa la configuración (clave, secreto, cloud y preset).
- **Preset de Cloudinary (`fc`):** tiene que ser *Signed*. La app pide la carpeta `facturas-facilitadores`. Si en el preset figura otra carpeta (por ejemplo la de ejemplo, `samples/ecommerce`), conviene cambiarla.

### Mi postulación

Cualquier usuario con sesión se postula para el **año lectivo actual**, sea facilitador (para seguir) o no (postulante nuevo). Así lo decidió el usuario el 24/11/2026, y es una excepción deliberada a "sin `ID_FACILITADOR` no se piden datos". Es la tabla del formulario JV26 (`POSTULANTES_FACILITADORES`).
- El servidor completa a partir del token `USUARIO` (el login, columna que agrega el script) y, si es facilitador, `ID_FACILITADOR`.
- Cada uno ve y carga **solo su** postulación: la de su `ID_FACILITADOR` o la de su `USUARIO`.
- Para quien no es facilitador, **Empezar de cero** precarga el nombre y el correo de la sesión.

- **Reglas (23/11/2026):**
  - Hay **una postulación por usuario y año**. Si ya existe, el envío la **corrige** en vez de crear otra. El índice único `UX_POSTULANTES_FAC_USUARIO_ANIO` frena un alta doble simultánea (409).
  - **Período de postulación** (24/11/2026): cargar, guardar sin terminar, subir documentos, corregir y eliminar se puede **solo mientras el período esté abierto**, según `FN_POSTULACION_ABIERTA(ID_ANIO) = 'SI'` (rango de fechas de `PERIODOS_POSTULACION` o habilitación extraordinaria).
    - `PERIODOS_POSTULACION` y la función **se cargan y mantienen desde el admin**. La app y el script solo las **leen**; el script verifica que existan.
    - Con el período cerrado, la postulación enviada se ve en **solo lectura** (sin Corregir, Editar ni Eliminar) y el servidor responde 409 a todo lo que escribe. Sin enviar, la pantalla dice cuándo abre o cuándo cerró (`textoPeriodo`). El aviso de Inicio y de la campana no aparece.
    - `FN_POSTULACION_ABIERTA` usa `TRUNC(SYSDATE)`, que en oracleapex.com es la fecha UTC: el día cambia a las 21:00 de Paraguay.
  - **"No estoy de acuerdo"** no envía nada.
  - El país es siempre **1 (Paraguay)**.
  - El año es `FN_ANIO_LECTIVO_ACTUAL()`. Si no está en `ANIOS_LECTIVOS`, la pantalla dice que no hay postulación abierta (`anio_registrado: false`).
- **Pantalla** (`screens/postulacion.tsx`): hay tres estados.
  - **Sin enviar:** una tarjeta "Postulación \<año\> · Abierta" con la lista de pasos y tres formas de empezar:
    - **Usar mis datos de \<año\>**, si hay una postulación de otro año.
    - **Empezar con mis datos de facilitador** (si ya es facilitador) o **Empezar de cero**. Si es facilitador, el formulario se precarga con su fila de `FACILITADORES`: el `GET` la manda tal cual en `facilitador`, solo la suya, y `datosDeFacilitador` lleva el texto libre a los códigos de la postulación (`SOLTERO`, `SI`/`NO`, `VIRTUAL`…). Lo que no reconoce queda vacío. No precarga la nacionalidad, porque es un id de `NACIONALIDADES`. `DENOMINACIÓN` se lee con SQL dinámico por la tilde.
    - **Seguir donde dejaste**, si hay algo cargado y sin enviar.
  - **Enviada:** la fecha de envío, el **resumen** por secciones y **Corregir**. **Editar** abre el formulario directo en esa sección.
  - **Eliminar mi postulación**, con confirmación, llama a `DELETE mi-postulacion`: borra la fila del año y sus documentos de Cloudinary, y la pantalla vuelve a "Sin enviar" para cargarla de nuevo.
  - **Cerrada:** si el año no está en `ANIOS_LECTIVOS`, "No hay una postulación abierta". Si el período está cerrado, cuándo abre o cuándo cerró, y la enviada en solo lectura.
- **Documentos (24/11/2026):** el paso **Documentos** pide, obligatorios, la **foto carnet** (solo foto), la **cédula frente y dorso**, el **CV**, el **certificado de no agresor** y los **antecedentes judiciales y policiales** (columnas `*_ARCHIVO` que agregó el usuario), y por cada estudio el **título** (concluido) o una **constancia** (cursando). Las reglas están en `documentosRequeridos` de `postulacion.ts` y se repiten en el paquete.
  - Cada archivo se sube **al elegirlo**, directo a Cloudinary (`subirACloudinary` de `cloudinary.ts`, compartido con Mis facturas), con la firma de `POST mi-postulacion/firma-documento`: preset Signed **`fcfacilitadores`**, carpeta `postulaciones-facilitadores`, `/auto/upload` para fotos y PDF. La postulación guarda el `secure_url` en las columnas `*_URL`.
  - **Fotos:** cámara o galería, achicadas a JPEG de hasta 3 MB (`tomarFoto` de facturas). **PDF:** `expo-document-picker` (módulo nativo, **requiere APK nuevo**), hasta 10 MB.
  - El secreto queda en Oracle. El paquete toma el cloud y el `api_key` de `PKG_CLOUDINARY_ETHOS.escribir_firma` y rehace la firma con el preset de las postulaciones.
  - **Borrado:** al firmar, el servidor elige el `public_id` y lo anota a nombre del usuario en `POSTULANTES_FAC_ARCHIVOS`, una tabla solo de la app. Solo ese usuario puede borrar ese archivo.
    - **Quitar**, reemplazar un documento o descartar el borrador llama a `DELETE mi-postulacion/documento?url=` (`quitarDocumento`). El archivo se borra enseguida si ninguna postulación guardada lo usa; si lo usa, al guardar la corrección.
    - Al corregir, el servidor borra los reemplazados, salvo que los use otra postulación.
    - Todo depende de `PKG_CLOUDINARY_ETHOS.borrar`: sin él, los archivos quedan.
    - Lo borrado de la galería del celular no se puede detectar.
  - **Cloudinary:** en el preset `fcfacilitadores` conviene cambiar *Asset folder* (figura `samples/ecommerce`) a `postulaciones-facilitadores` o dejarlo vacío. Para que **Ver** abra los PDF, en *Settings → Security* tiene que estar habilitado *Allow delivery of PDF and ZIP files*.
- **Formulario** (`postulacion-form.tsx`): 9 pasos más **Revisar y enviar**, uno por pantalla.
  - **Navegación:** una barra de progreso arriba, con un chip por paso. Se puede volver a cualquier paso ya visitado, y cada paso empieza desde arriba (`useSubirAlInicio` del shell).
  - **Opciones:** van en **botones**, no en listas desplegables, y los campos condicionales aparecen solo cuando corresponden: el título si está concluido o cursando, el curso `2/4` si está cursando, empresa y cargo si trabaja, el vehículo si tiene movilidad, y "¿Cuál?" si el estado civil es Otro.
  - **Fecha de nacimiento:** se escribe como `DD/MM/AAAA` y muestra la edad. El calendario de facturas va mes por mes y para un nacimiento no sirve.
  - **Departamento y ciudad:** se eligen en una lista con buscador (`GET mi-postulacion/lugares`, que se pide una vez por sesión).
  - **Ubicación de la casa:** **Usar mi ubicación** pone `latitud, longitud` del GPS (`expo-location`, que ya está en el APK). También se puede pegar el enlace de Google Maps, y **Ver en el mapa** lo abre.
  - **Atajos:** **La cuenta es mía** copia el nombre y la cédula al titular, y **La factura la emito yo** copia el nombre al emisor.
  - **Validación:** cada paso se valida al tocar **Siguiente**, con los valores de los `CHECK` de la tabla. Cada nivel de estudio usa sus propios códigos, por ejemplo `CONCLUIDA` e `INCONCLUSA` en licenciatura. Al enviar se revisan todos los pasos, y si el servidor rechaza un campo, la app lleva al paso donde está.
- **Ningún campo es obligatorio para guardar** (24/11/2026). **Guardar** (en cada paso) y **Guardar y terminar después** (último paso, si falta algo) mandan lo cargado **sin validar** a `PUT mi-postulacion/borrador`, que lo guarda en `POSTULANTES_FAC_BORRADORES`, una tabla solo de la app con una fila por usuario y año.
  - Además, lo válido de lo cargado va a `POSTULANTES_FACILITADORES` con **`ESTADO = 'INCOMPLETO'`** (24/11/2026), así los administradores ya ven lo que hay. Lo que falta o no es válido queda vacío. La fila aparece desde el primer **Guardar** con el acuerdo aceptado, aunque falten nombre y cédula. La app la sigue mostrando como "sin enviar". El script amplía la CHECK de `ESTADO` para aceptar `INCOMPLETO` y les saca el `NOT NULL` a `NOMBRE_COMPLETO` y `CEDULA`, que siguen siendo obligatorios para enviar.
  - **Enviar** pide todo completo y deja esa misma fila completa en **`PENDIENTE`**; el borrador se borra.
  - Una postulación **ya enviada** que se está corrigiendo no se pisa con datos a medias: **Guardar** deja la corrección solo en el borrador hasta enviarla.
  - **Descartar** borra el borrador y la fila `INCOMPLETO`.
  - **El proceso** (primer paso) muestra `ANIOS_LECTIVOS.PROCESO_POSTULACION` del año abierto, que llega como `proceso` en `GET mi-postulacion`. Puede ser texto plano o HTML del editor de APEX; `textoDeProceso` lo pasa a texto con párrafos y viñetas. Sin **Estoy de acuerdo** no se puede seguir ni guardar.
  - **Aviso de lo que falta** (`aviso-postulacion.tsx`): lista los datos que faltan en cada paso y los archivos. Sale en **Inicio**, en la **campana** (con su punto de "nueva", que vuelve a aparecer si cambia lo que falta) y en Mi postulación. Inicio y la campana comparten una sola consulta, que Mi postulación actualiza cada vez que carga. Si no la empezó, invita a empezarla.
  - **Siguiente** ya no frena. Lo que falta lo calcula `faltantes()` y se muestra en el último paso, en la pantalla y en **Inicio** (`AvisoPostulacionInicio` de `aviso-postulacion.tsx`), con datos por paso y archivos que faltan.
  - Lo no guardado queda en memoria, por usuario y año. En el dispositivo nunca se guarda nada, porque incluye datos bancarios.
  - Descartar (`DELETE mi-postulacion/borrador`) o eliminar la postulación borra también el borrador y sus documentos de Cloudinary.
- **Backend:** `GET` y `POST mi-postulacion` y `GET mi-postulacion/lugares` (ver [sql/README.md](sql/README.md)). El `POST` manda el JSON entero, que el paquete lee de `:body_text`. `EDAD` la calcula el servidor, y `FECHA_REGISTRO` queda en hora de Paraguay y es la del primer envío.
- **Formatos que eligió la app:**
  - `DIAS_DISPONIBLES` se guarda como `LUNES,MARTES,MIERCOLES` (sin tildes, en el orden de la semana).
  - `UBICACION_DOMICILIO` se guarda como `latitud, longitud` o como el enlace de Google Maps.
- **Pendiente:** el texto del paso **El proceso** es general. Hay que reemplazarlo por las etapas y los requisitos reales de la fundación.

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
  - **Menú** abre un panel con **todas** las secciones (Inicio, Registrar intervención, Intervenciones realizadas, Historial de intervenciones, Mi agenda, Mis materiales, Evaluaciones, Formularios, Mis facturas, Mi postulación, Mi perfil) y el Centro de ayuda. Las secciones nuevas aparecen ahí solas.
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
| Formularios (APK): PDF o Imagen no abren nada, o la app "no responde" | APK anterior a `expo-sharing` / `react-native-webview` (la vista previa con react-native-svg bloqueaba el hilo principal) | Instalar un APK nuevo |
| Mis facturas: "Falta publicar en el backend los endpoints de mis-facturas" | No se corrió `sql/facturas_app_ethos.sql` | Correrlo en APEX, después de `cloudinary.sql` y `facturas_facilitadores.sql` del sitio |
| Mis facturas: "Todavía no se pueden subir fotos" | Cloudinary no está configurado en Oracle (`PKG_CLOUDINARY_ETHOS.falta`) | Configurarlo como en `cloudinary.sql` del sitio |
| Mis facturas (APK): **Sacar foto** no abre la cámara | APK anterior al permiso de cámara | Instalar un APK nuevo |
| Mis facturas: al borrar, la foto queda en Cloudinary | El `PKG_CLOUDINARY_ETHOS` de Oracle no tiene `BORRAR` (el script lo avisa con `[WARN]`) | Borrarla a mano en Cloudinary, o correr el `cloudinary.sql` nuevo del sitio |
| Mi postulación: "Falta publicar en el backend los endpoints de mi-postulacion" | No se corrió `sql/postulacion_app_ethos.sql` | Correrlo en APEX (deben quedar 3 de 3 handlers) |
| Mi postulación: "No hay una postulación abierta" | El año lectivo actual (`FN_ANIO_LECTIVO_ACTUAL()`) no está en `ANIOS_LECTIVOS` | Cargar el año en `ANIOS_LECTIVOS`. El script lo avisa con `[WARN]` |
| Mi postulación: **Usar mi ubicación** no hace nada o pide permiso | El navegador o el celular no dio permiso de ubicación | Habilitarlo, o pegar el enlace de Google Maps de la casa |
| `Unmatched Route` en `/postulacion` (u otra sección nueva) | El servidor de desarrollo no tomó la ruta nueva | Recargar la página, o reiniciar con `npx expo start --clear` |
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
- El **login de la web** tiene el botón **Descargar la app para Android** (`src/facilitadores/descarga-apk.ts`), que abre esa URL. No aparece en iPhone/iPad ni dentro de la app instalada. Cada toque le agrega `?v=<hora>`, porque GitHub deja en caché un 404 de la URL fija si alguien la pidió mientras el workflow reemplazaba el archivo.
- El JS va dentro del APK: la app **abre sin conexión**, pero los datos vienen del servidor.

### Android: Google Play (AAB)

El mismo workflow genera también **`facilitadores.aab`**, el archivo que se sube a Google Play Console, y lo publica en el release `apk-latest` junto al APK:

```
https://github.com/josegalvez1985/facilitador-hub/releases/download/apk-latest/facilitadores.aab
```

- Se genera solo si están cargados los Secrets de la **clave de subida** (abajo). Sin ellos, el workflow genera solo el APK, como antes.
- El AAB se firma con la clave de subida; el APK sigue con la de depuración, así nadie tiene que desinstalar. Con **Play App Signing**, Google vuelve a firmar con su propia clave lo que instala, por eso la app de Play y el APK no se instalan uno encima del otro: quien pase a la de Play desinstala el APK una vez.
- El `versionCode` es el número de corrida del workflow, igual que el del APK. Play no acepta repetir uno ya subido.
- Por ahora se sube **a mano** en Play Console. La primera versión tiene que subirse a mano sí o sí; después se puede automatizar con una cuenta de servicio de Google Play.
- Antes de la primera subida, confirmar el paquete `com.facilitadores.app` (`app.json`): en Play es único en el mundo y **no se puede cambiar** después.

**Preparación (una sola vez):**

1. Crear la clave de subida, en PowerShell, **fuera del repo** (`keytool` viene con Android Studio o cualquier JDK). Pide una contraseña:

   ```powershell
   keytool -genkeypair -v -storetype PKCS12 -keystore facilitadores-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Guardá el `.jks` y la contraseña en un lugar seguro y con copia: sin ellos no se pueden subir versiones nuevas (Google permite reemplazarla, pero lleva días).

2. Copiar el `.jks` en base64 al portapapeles:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("facilitadores-upload.jks")) | Set-Clipboard
   ```

3. En GitHub, **Settings → Secrets and variables → Actions → Secrets**, cargar:

   | Secret | Valor |
   |---|---|
   | `UPLOAD_KEYSTORE_BASE64` | lo copiado en el paso 2 |
   | `UPLOAD_STORE_PASSWORD` | la contraseña del `.jks` |
   | `UPLOAD_KEY_ALIAS` | `upload` |
   | `UPLOAD_KEY_PASSWORD` | la misma contraseña (con PKCS12 es una sola) |

4. Opcional pero recomendado: en la pestaña **Variables** de esa pantalla, `FIRMA_PLAY_ESPERADA` con el SHA-256 del certificado (sale con `keytool -list -v -keystore facilitadores-upload.jks -alias upload`, o del aviso del workflow). Así el workflow corta si el AAB sale firmado con otra clave.

**Manual (EAS Build):** el APK se compila en la nube de Expo. Requiere una cuenta gratuita de Expo.

```sh
npx eas-cli@latest login
npm run build:apk
```

Al terminar, EAS entrega un link y un código QR para descargar el `.apk` e instalarlo en el celular. Hay que permitir "instalar apps de origen desconocido". El perfil está en `eas.json` → `apk`.

### iOS y web: PWA en facilitadoresfc.online

En iPhone la app se usa como PWA (aplicación web) desde **https://facilitadoresfc.online**: Safari → botón Compartir → **Agregar a pantalla de inicio**. Siempre necesita conexión (no hay modo sin conexión en la web).

**Automático (GitHub Actions):** cada push a `main` publica la web en GitHub Pages ([.github/workflows/web.yml](.github/workflows/web.yml)): `expo export --platform web`, más un `404.html` igual al `index.html` (Pages no tiene reescrituras: así recargar `/horarios` o abrir un enlace directo carga la app), `.nojekyll` (por la carpeta `_expo/`) y `CNAME`. Los cambios que solo tocan `.md`, `sql/`, `docs/` o `__tests__/` no publican.

**Preparación (una sola vez):**

1. En GitHub, **Settings → Pages → Build and deployment → Source**: **GitHub Actions**.
2. En el DNS de `facilitadoresfc.online`:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `josegalvez1985.github.io` |

3. **Settings → Pages → Custom domain**: `www.facilitadoresfc.online` (el principal; `facilitadoresfc.online` redirige ahí). Con despliegue por Actions el archivo `CNAME` no alcanza: hay que cargarlo ahí. Cuando GitHub emita el certificado, tildar **Enforce HTTPS** (la PWA y la ubicación necesitan HTTPS).
4. Correr el workflow **Web** (pestaña Actions → **Run workflow**) o hacer un push.

- **Al compartir el enlace** (WhatsApp, Facebook, Telegram…) se ve el logo, el nombre y la descripción: son las etiquetas Open Graph de `public/index.html`, con la URL absoluta de `public/logo.png`. Esos bots no ejecutan JavaScript, por eso van en el HTML. WhatsApp guarda la vista previa de cada enlace un tiempo; para probar un cambio, compartí la URL con algo distinto al final (`?v=2`). Facebook la vuelve a leer con su *Sharing Debugger*.
- **Google:** el ícono de los resultados es el favicon (`favicon.png` 48 px y `logo192.png`), y el nombre del sitio sale del bloque `WebSite` (JSON-LD) de `index.html`. `sitemap.xml` y `robots.txt` lo invitan a indexar la portada. Para que aparezca antes: [Google Search Console](https://search.google.com/search-console) → agregar la propiedad `facilitadoresfc.online` (tipo *Dominio*, se verifica con un registro TXT en el DNS) → **Sitemaps** → `https://www.facilitadoresfc.online/sitemap.xml` → **Inspección de URLs** → la portada → **Solicitar indexación**. Google tarda de días a semanas en mostrar el ícono.
- Si se cambia el dominio principal, cambiar también esas URLs en `index.html`, `sitemap.xml` y `robots.txt`.
- La app se sirve en la **raíz** del dominio. En `josegalvez1985.github.io/facilitador-hub/` no carga, porque los archivos se piden a `/`.
- GitHub Pages en un repositorio **privado** necesita un plan pago de GitHub.
- Si después de publicar el login da "blocked by CORS policy", revisar en ORDS que el módulo `ethos` acepte el origen `https://facilitadoresfc.online`.

**Manual:** `npm run build:pwa` genera `dist/`, que se puede publicar en cualquier hosting con HTTPS que devuelva `index.html` para todas las rutas.

El ícono, el nombre y la pantalla completa salen de `public/manifest.json`, `public/apple-touch-icon.png` y `public/index.html`.

### Logo e íconos

El logo original está en `public/logo.png`. A partir de él se generaron:

- `assets/icon.png`: ícono de la app
- `assets/android-icon-*.png`: ícono adaptativo de Android
- `assets/splash-icon.png`: pantalla de carga
- `public/logo192.png`, `public/logo512.png`, `public/logo-maskable.png`, `public/apple-touch-icon.png` y `favicon.png`: íconos de la PWA
- `assets/images/logo.png`: logo dentro de la app

Las carpetas `ios/` y `android/` se generan automáticamente y no se versionan.
