# Backend (Oracle APEX / ORDS)

La app usa el módulo ORDS **`ethos`**, ya publicado en el esquema `WKSP_FUNDCARAC` (workspace APEX `FUNDCARAC`). Ahí están el login y los endpoints de negocio, y los usuarios son los mismos del sistema anterior.

```
https://oracleapex.com/ords/fundcarac/ethos/
```

Esa es la URL de `EXPO_PUBLIC_API_URL` en `.env`.

| Archivo | Qué es |
|---|---|
| [ords_modulo_ethos_export.sql](ords_modulo_ethos_export.sql) | Exportación del módulo `ethos` **tal como está publicado**: es la referencia de verdad. Está **incompleta**: se corta en `menu-paginas`. Reemplazala por la exportación completa (ORDS → REST → Export). |
| [auth_facilitadores.sql](auth_facilitadores.sql) | Alternativa **no usada y no publicada**: el script de autenticación renombrado a `FACILITADORES_TOKENS` / `PKG_AUTH_FACILITADORES` / módulo `facilitadores`. Se descartó porque sus tokens no sirven para los endpoints de negocio de `ethos`, que validan contra `ETHOS_TOKENS`. **No correrlo** salvo que se migren también esos endpoints. |
| [facilitador_app_ethos.sql](facilitador_app_ethos.sql) | **Para correr una vez en APEX.** Crea el paquete `PKG_FACILITADOR_APP_ETHOS` y publica en `ethos` los endpoints `GET mi-facilitador` y `GET mis-evaluaciones`. No redefine el módulo ni toca tablas. |
| [historial_app_ethos.sql](historial_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_HISTORIAL_APP_ETHOS` (páginas 7 y 8) y publica `historial-intervenciones` y `historial-intervenciones/:id` (GET y PUT). No pisa rutas existentes. **Si lo corriste antes del 04/11/2026**, revisá que `:id` tenga GET y PUT (ver *Rutas con dos métodos*): si falta el GET, "Editar intervención" no abre. Volvé a correr el script y la salida tiene que decir 3 de 3. |
| [intervenciones_realizadas_app_ethos.sql](intervenciones_realizadas_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_REALIZADAS_APP_ETHOS` (páginas 4, 5 y 6) y publica `intervenciones-realizadas/*`. No pisa rutas existentes. |
| [materiales_app_ethos.sql](materiales_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_MATERIALES_APP_ETHOS` (Mis materiales) y publica `GET mis-materiales`. No pisa rutas existentes. |
| [agenda_app_ethos.sql](agenda_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_AGENDA_APP_ETHOS` (Mis horarios, página 3) y publica `GET mi-agenda`. No pisa rutas existentes. |
| [intervenciones_app_ethos.sql](intervenciones_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_INTERVENCIONES_APP_ETHOS` (Marcar, página 2) y publica `mis-intervenciones/*`. No pisa rutas existentes: si alguna ya existe y no es de este paquete, se detiene sin tocar nada. |
| [formularios_app_ethos.sql](formularios_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_FORMULARIOS_APP_ETHOS` (Form. 1, 2 y 3) y publica `mis-formularios/*`. Solo lectura. No pisa rutas existentes. |
| [facturas_app_ethos.sql](facturas_app_ethos.sql) | **Para correr una vez en APEX**, después de `cloudinary.sql` y `facturas_facilitadores.sql` del sitio. Crea `PKG_FACTURAS_APP_ETHOS` (Mis facturas) y publica `mis-facturas/*`: el facilitador sube la foto de su factura física. Escribe en `FACTURAS_FACILITADORES`, la misma tabla del sitio. No pisa rutas existentes. |
| [postulacion_app_ethos.sql](postulacion_app_ethos.sql) | **Para correr en APEX**, con `POSTULANTES_FACILITADORES` ya creada con `ID_FACILITADOR` y su FK, y con `PKG_CLOUDINARY_ETHOS` del sitio. Le agrega a la tabla las 7 columnas de documentos (`*_URL`) si faltan, crea `PKG_POSTULACION_APP_ETHOS` (Mi postulación) y publica `mi-postulacion/*` (4 handlers). No pisa rutas existentes. |

Nada de esto se ejecuta desde la app.

## Endpoints de la app (`PKG_FACILITADOR_APP_ETHOS`)

Todos sacan el `ID_FACILITADOR` **del token**, en el servidor (`FACILITADORES.USUARIO = usuario del token`, igual que `:APP_USER` en APEX). El cliente nunca manda el id: un facilitador no puede ver datos de otro aunque modifique la URL.

La única excepción, pedida a propósito, es `cumpleanios-hoy`: muestra a todos los facilitadores activos que cumplen hoy, pero devuelve **solo el nombre**. Nunca devuelve la fecha de nacimiento, la edad, el id ni otro dato de `FACILITADORES`.

| Método | Ruta | Responde |
|---|---|---|
| GET | `mi-facilitador` | `{ success, data: { usuario, id_facilitador, es_facilitador } }`. `id_facilitador: null` si el usuario no está en `FACILITADORES`; 401 si el token no sirve. |
| GET | `mis-evaluaciones` | Página 11 de APEX: `{ success, es_facilitador, data: [ { fecha_desde, aspectos_positivos, aspectos_mejorar, marcadas, calificacion, puntuacion, indicador } ] }` |
| GET | `cumpleanios-hoy` | Cumpleaños del día en Inicio: `{ success, es_facilitador, data: [ { nombre, soy_yo } ] }`. Se toman los facilitadores con `FECHA_NACIMIENTO` del día de hoy en Paraguay (`SYSDATE - 3/24`), comparando `'MMDD'`, que no depende del idioma. Quedan afuera los que tienen `ACTIVO` empezando con N o I. Los nacidos un 29/02 se saludan el 28/02 en años no bisiestos. Si el usuario no es facilitador, la lista viene vacía. |

Cómo instalarlo: APEX → SQL Workshop → SQL Scripts → Upload `facilitador_app_ethos.sql` → Run, con el usuario dueño del esquema. La salida debe decir `[OK] PKG_FACILITADOR_APP_ETHOS compilado` y `Handlers nuevos publicados: 3 de 3`, y lista los valores de `ACTIVO` para confirmar el filtro.

## Mis horarios: agenda (`PKG_AGENDA_APP_ETHOS`)

Página 3 "Agenda" de APEX. `GET mi-agenda` corre el mismo SELECT del reporte (`V_AGENDA` con `USUARIO = :APP_USER`, `ESTADO` Activo, `ANIO = FN_ANIO_LECTIVO_ACTUAL()`, mismo `ORDER BY`), con el usuario sacado del token.

Responde `{ success, es_facilitador, data: [ { id_institucion, nombre_institucion, turno, turno_descripcion, grado, lunes … viernes, seccion, nombre_profesor, id_enfasis, enfasis, id_materia, manual, estado, id_postulacion, anio, departamento, ciudad } ] }`. Los días vienen como en la vista: `"08:20, 09:00"`, o `", "` si ese día no hay clase. `turno_descripcion` sigue la LOV de la página: 1 Mañana, 2 Tarde, 3 Noche.

Por clase también devuelve:
- `indice_siguiente` / `nro_indice_siguiente`: el **siguiente al último desarrollado**, es decir, el `NRO_INDICE` inmediato mayor al más alto con `SI_NO = 'Si'` en esa postulación, dentro de su manual. Si no hay ninguno desarrollado, es el primero; si ya está todo desarrollado, viene `null` (manual completado).
- `indices_desarrollados` e `indices_total`.

## Historial de intervenciones (`PKG_HISTORIAL_APP_ETHOS`)

Páginas 7 "Historial de Intervenciones" y 8 "Observación". Script: [historial_app_ethos.sql](historial_app_ethos.sql), **para correr una vez en APEX**; no pisa rutas existentes.

| Método | Ruta | Página | Envía / responde |
|---|---|---|---|
| GET | `historial-intervenciones` | 7 | `{ success, es_facilitador, data: [ { id_intervencion, fecha_hora, fecha, hora, manual, id_indice, indice, observacion, si_no, motivo_desarrollo, id_institucion, nombre, turno, turno_descripcion, grado, id_enfasis, descripcion } ] }`. Mismo SELECT de la página (`V_HISTORIAL_INTERVENCIONES`, año lectivo, `ID_INTERVENCION DESC`); `grado` = `GRADO||' '||SECCION`. |
| GET | `historial-intervenciones/:id` | 8 (al abrir) | `{ success, data: { id_intervencion, manual, id_indice, si_no, motivo_desarrollo, observacion, indices:[{id_indice,titulo}], motivos:[…] } }`. Índices: LOV de `P8_ID_INDICE` (`nlssort … binary_ai` por manual). 404 si no es tuya o no es del año lectivo. |
| PUT | `historial-intervenciones/:id` | 8 (Aplicar Cambios) | Envía `{ id_indice, si_no, motivo_desarrollo, observacion }`. 200 `{ id_intervencion }` · 400 `{ message, campo }` · 404. |

- Validaciones del PUT: índice y Sí/No obligatorios; cada valor en su LOV; observación hasta 1000 (con trim); `OBS`: con "No" + "Otros" la observación es obligatoria. Los triggers de `INTERVENCIONES` corren como con APEX y sus errores llegan como 400.
- El motivo se guarda tal como llega aunque la respuesta sea "Si" (APEX solo lo oculta).
- Las facetas Mes y Fecha y el buscador se aplican en la app sobre las filas, usando `fecha_hora` (no depende del idioma de `TO_CHAR(…,'Month')`).

## Intervenciones realizadas (`PKG_REALIZADAS_APP_ETHOS`)

Páginas 4 "Intervenciones", 5 "Días" y 6 "Manuales" de APEX. Script: [intervenciones_realizadas_app_ethos.sql](intervenciones_realizadas_app_ethos.sql), **para correr una vez en APEX**; no pisa rutas existentes. Cada GET corre la consulta de su página con el `ID_FACILITADOR` sacado del token.

| Método | Ruta | Página | Responde |
|---|---|---|---|
| GET | `intervenciones-realizadas/instituciones` | 4 | `{ success, es_facilitador, data: [ { id_institucion, nombre_institucion, marcaciones, desarrolladas } ] }` |
| GET | `intervenciones-realizadas/clases?id_institucion=` | 5 | `{ success, es_facilitador, data: { filas: [ { id_postulacion, turno, turno_descripcion, grado, seccion, id_enfasis, enfasis, lunes … viernes } ], resumen: [ { turno, grado, seccion, marcaciones, desarrolladas } ] } }` |
| GET | `intervenciones-realizadas/historial?id_institucion=&turno=&grado=&seccion=` | 6 | `{ success, es_facilitador, data: [ { id_intervencion, fecha_hora, manual, id_indice, indice, observacion, desarrollo } ] }` |

- Las LOVs de las páginas se resuelven en el servidor: énfasis con `ENFASIS.DESCRIPCION`, índice con `INDICES_MANUALES.TITULO`, turno 1 Mañana / 2 Tarde / 3 Noche.
- `filas` son las de la página 5 tal cual (una por día marcado, con `grado||' '||seccion` en la columna del día); la app las agrupa por turno, grado y `NVL(seccion,'A')`, la misma clave con la que filtra la página 6. `resumen` trae los contadores con esa clave.
- Agregados de la app, que no cambian las filas: los contadores (`marcaciones`, y `desarrolladas` con `SI_NO = 'Si'`) y el orden de la página 5 por turno, grado y sección.

## Mis materiales (`PKG_MATERIALES_APP_ETHOS`)

`GET mis-materiales`: por cada postulación del facilitador en el año lectivo actual (de `V_AGENDA`, en cualquier estado, incluidas las `Finalizado`), su manual con **todos** los índices de `INDICES_MANUALES`:

```
{ success, es_facilitador, data: [ { id_postulacion, institucion, grado, seccion, turno, turno_descripcion, manual, estado,
  indices: [ { id_indice, nro_indice, titulo, desarrollado, fecha_desarrollo } ] } ] }
```

Un índice está desarrollado si tiene alguna intervención con `SI_NO = 'Si'` en esa postulación; `fecha_desarrollo` es la última. El manual se compara con el mismo `TRANSLATE(UPPER(...))` de la página 2.

## Marcar: intervenciones (`PKG_INTERVENCIONES_APP_ETHOS`)

Corresponde a la página 2 "Intervención" de APEX. Cada GET corre **el mismo select** del ítem APEX, y `:P2_ID_FACILITADOR` / `:APP_USER` salen del token.

| Método | Ruta | Equivale a | Responde (`data`) |
|---|---|---|---|
| GET | `mis-intervenciones/inicio` | LOV y default de `P2_ID_INSTITUCION`, LOV `DESARROLLO_MOTIVOS` | `{ es_facilitador, instituciones:[{id,nombre}], institucion_por_defecto, motivos:[…], requiere_ubicacion }` |
| GET | `mis-intervenciones/horarios?id_institucion=` | LOV de `P2_ID_POSTULACION` | `[ { id_postulacion, horario } ]` |
| GET | `mis-intervenciones/clase?id_institucion=&id_postulacion=` | LOVs de `P2_GRADO`, `P2_SECCION`, `P2_TURNO`, `P2_ID_ENFASIS`, `P2_MANUAL` | `{ grados, secciones, turnos:[{turno,descripcion}], enfasis:[{id_enfasis,descripcion}], manuales }` |
| GET | `mis-intervenciones/indices?id_postulacion=&manual=&grado=&turno=` | LOV y default de `P2_ID_INDICE` | `{ indices:[{id_indice,titulo}], indice_por_defecto }` |
| GET | `mis-intervenciones/resumen` | KPIs de Inicio | `{ es_facilitador, del_mes, desarrolladas_del_mes, mes, instituciones, indices_desarrollados, manuales_desarrollados }`. Instituciones: distintas en `POSTULACIONES` del año lectivo. Índices: desarrollados hasta la fecha (sin repetir en la misma postulación). Manuales: postulaciones `Finalizado`. |
| GET | `mis-intervenciones/recientes?limite=5` | "Actividad reciente" de Inicio | `[ { id_intervencion, fecha_hora, si_no, motivo_desarrollo, manual, indice, institucion, grado, seccion } ]` |
| GET | `mis-intervenciones/por-dia` | Gráfico semanal de Inicio | `{ es_facilitador, anio, dias:[ { fecha:'YYYY-MM-DD', total, si, no } ] }`: intervenciones del facilitador por día en el año lectivo actual (`INTERVENCIONES.ANIO = FN_ANIO_LECTIVO_ACTUAL()`). `no` incluye `SI_NO` nulo, como el KPI del mes. |
| POST | `mis-intervenciones` | Botón Guardar (validaciones + INSERT) | 200 `{ id_intervencion }` · 400 `{ message, campo }` · 403 si no es facilitador |

Validaciones del POST:
- Los obligatorios de la página.
- Cada valor tiene que estar en su lista. Esto asegura también que la institución y la postulación son del facilitador.
- `TRG_INTERV_SINO_MOTIVO`: motivo obligatorio cuando la respuesta es No.
- `OBS`: observación obligatoria con "No" + "Otros".
- Ubicación: obligatoria salvo `IND_UBICACION_POSTULACION = 'NO'`.

`FECHA_HORA` (hora de Paraguay, `SYSDATE - 3/24`), `ANIO`, `ID_AUDITORIA` y la finalización de la postulación los ponen los triggers de `INTERVENCIONES`, como con APEX. La auditoría registra al usuario del token, porque `validar_token` lo deja en `CLIENT_IDENTIFIER`.

**`V_INSTITUCIONES_APP_ETHOS`.** La página 2 lee `V_INSTITUCIONES`, que solo trae las clases del día de hoy y compara el día con `TO_CHAR(.., 'FMDAY')`. Ese nombre sale en el idioma de la sesión: en APEX es "VIERNES", pero en ORDS es "FRIDAY", así que desde la app la vista quedaba vacía y Marcar no mostraba instituciones.
- Para no tocar nada de APEX, el script crea **`V_INSTITUCIONES_APP_ETHOS`**: una copia exacta de `V_INSTITUCIONES` con el día calculado con `NLS_DATE_LANGUAGE=SPANISH`. El paquete lee esa copia; `V_INSTITUCIONES` queda intacta para APEX.
- Al final, el script compara cuántas clases de hoy trae cada vista. Tienen que ser iguales.
- Si alguna vez cambia `V_INSTITUCIONES`, hay que repetir el cambio en la copia.
- [diagnostico_marcar.sql](diagnostico_marcar.sql): de solo lectura, explica por qué una institución no aparece en Marcar para un usuario. Usa `V_INSTITUCIONES`, o sea, lo que ve APEX.

## Formularios 1, 2 y 3 (`PKG_FORMULARIOS_APP_ETHOS`)

Los formularios del sitio editorial-ethos-app (`postulaciones/formulario`, `postulaciones/todas`, `intervenciones-crud`, `facilitadores-bloqueos`, `etapas`), con las mismas consultas pero con el `ID_FACILITADOR` sacado **del token**. Esos endpoints del sitio devuelven datos de todos los facilitadores, así que la app no los usa. Script: [formularios_app_ethos.sql](formularios_app_ethos.sql), **para correr una vez en APEX**. Solo lectura; no toca objetos de APEX.

| Método | Ruta | Para | Responde |
|---|---|---|---|
| GET | `mis-formularios/postulaciones?anio=` | Form. 1, 2 y 3 | `{ success, es_facilitador, anio, anio_actual, anios[], facilitador: { nombre, telefono }, etapas: [ { fecha_inicio, fecha_fin } ], data: [ { id, id_institucion, institucion, turno, seccion, g2 … g3m, ser … liderazgo, lunes_desde … viernes_hasta, enfasis, estado } ] }`. Solo sus postulaciones activas del año (vacío = `FN_ANIO_LECTIVO_ACTUAL()`). |
| GET | `mis-formularios/institucion?id_institucion=&anio=` | Form. 1 y 2 | Lo de `postulaciones/formulario`: `nombre`, `direccion`, `departamento`, `ciudad`, `barrio`, `autoridades[]`, `horarios[]` y `detalle[]` con **solo sus** postulaciones activas, numeradas por turno. 404 si no tiene postulaciones en esa institución ese año. |
| GET | `mis-formularios/intervenciones?id_institucion=&desde=&hasta=` | Form. 2 | `{ success, data: [ { id_intervencion, id_postulacion, fecha (DD/MM/YYYY), nro_indice, si_no, motivo_desarrollo } ] }`. Fechas `YYYY-MM-DD`, inclusive, hasta 400 días. |
| GET | `mis-formularios/bloqueos?anio=` | Form. 3 | `{ success, data: { lunes … viernes } \| null }`: sus franjas bloqueadas (`"07:00 - 11:40, 13:00 - 17:05"`). `FACILITADORES_DIAS_BLOQUEOS` se lee con SQL dinámico: si la tabla no existe, el paquete compila igual y devuelve `null`. |

Cómo instalarlo: SQL Workshop → SQL Scripts → Upload `formularios_app_ethos.sql` → Run. La salida debe decir `[OK] PKG_FORMULARIOS_APP_ETHOS compilado` y `Handlers de mis-formularios publicados: 4 de 4`.

## Autenticación (`PKG_AUTH_ETHOS`)

| Método | Ruta | Envía | Responde |
|---|---|---|---|
| POST | `auth/login` | JSON `{ "usuario", "password" }` | 200 `{ success: true, data: { token, usuario, nombre, email, expira } }`, 401 si las credenciales son incorrectas, 403 si el usuario está bloqueado, 200 `success:false` si falta un campo |
| POST | `auth/logout` | `Authorization: Bearer <token>` | `{ success, message }` |
| GET | `auth/me` | `Authorization: Bearer <token>` | `{ success, data: { usuario, nombre, email, expira } }` o 401 |

El cliente está en [src/facilitadores/auth/api.ts](../src/facilitadores/auth/api.ts).

- **Token:** dura 6 horas y no se renueva. Hay **un solo token activo por usuario**, compartido con el sistema anterior: entrar en la app cierra la sesión del usuario en el otro sistema, y al revés. Cuando eso pasa, la app muestra "Tu sesión se cerró" y vuelve al login.
- **`expira`:** viene sin zona horaria (`YYYY-MM-DDTHH24:MI:SS`, hora del servidor).
- **Usuario:** se compara en MAYÚSCULAS. Una cuenta bloqueada (`ACCOUNT_LOCKED = 'Y'`) recibe un 403.

## Endpoints de negocio publicados (módulo `ethos`)

Todos piden `Authorization: Bearer <token>` y se llaman con `authFetch`. Los parámetros de un GET viajan en el query string; los de POST y PUT, en un JSON plano.

| Ruta | Métodos | Paquete | Parámetros principales | Uso posible en la app |
|---|---|---|---|---|
| `agendas` | GET | `PKG_AGENDAS_ETHOS.LISTAR` | `anio, manual, id_facilitador, id_institucion, turno, dia` (sin tilde: `Miercoles`), `departamento, ciudad` (por nombre), `buscar, estado, limite, pagina` | **Mis horarios** |
| `agendas/filtros` | GET | `PKG_AGENDAS_ETHOS.FILTROS` | Los mismos filtros, en cascada | Filtros de horarios |
| `intervenciones-crud` | GET, POST | `PKG_INTERV_CRUD_ETHOS` | GET: `anio, mes, id_facilitador, id_institucion, buscar, limite, pagina`. POST: `id_postulacion, id_indice, si_no, fecha_hora, motivo_desarrollo, observacion, latitud, longitud, grado, seccion` | **Marcar** (con ubicación) |
| `intervenciones-crud/:id` | GET, PUT, DELETE | `PKG_INTERV_CRUD_ETHOS` | Los mismos campos del POST | Ver o editar una marcación |
| `intervenciones` | GET | `PKG_INTERVENCIONES_ETHOS.LISTAR` | `anio, mes` (texto: `Agosto`), `id_facilitador, limite` | Actividad reciente |
| `intervenciones/por-dia` | GET | `PKG_INTERVENCIONES_ETHOS.POR_DIA` | `anio, mes` (texto), `si_no` (`SI`/`NO`) | Estadísticas de Inicio |
| `listas/:nombre` | GET | `PKG_EVAL_FACILITADORES_ETHOS.LISTA` | `buscar, id_area, activo, estado, incluir_id, id_facilitador, id_institucion, id_postulacion, dia, manual, anio, limite` | Combos: instituciones, índices, manuales… |
| `evaluaciones-facilitadores` | GET, POST | `PKG_EVAL_FACILITADORES_ETHOS` | GET: `id_facilitador, id_institucion, id_evaluacion, id_area, desde, hasta, buscar, limite, pagina` | Administración. La app **no** lo usa: recibe el id por URL. Para el facilitador se usa `mis-evaluaciones`, que saca el id del token. |
| `evaluaciones-facilitadores/:id` | GET, PUT, DELETE | `PKG_EVAL_FACILITADORES_ETHOS` | El PUT no cierra ni reabre | |
| `evaluaciones-facilitadores/cierre` | POST | `CAMBIAR_CIERRE` | `ids, ind_cerrado` | |
| `menu` | GET | `PKG_ROLES_PAGINAS_ETHOS.MENU` | — | Menú según el rol del usuario |
| `menu-paginas` | GET | `PKG_ROLES_PAGINAS_ETHOS.PAGINAS_LISTAR` | (exportación cortada) | |
| `auditoria/tablas`, `auditoria/movimientos`, `auditoria/historial` | GET | `PKG_AUDITORIA_ETHOS` | `tabla, operacion, usuario, desde, hasta` (hora de Paraguay), `id_auditoria, limite, pagina, buscar` | Administración (no es de esta app) |
| `sucursales`, `sucursales/:id` | GET, POST, PUT, DELETE | `PKG_SUCURSALES_ETHOS` | `descripcion` | No es de esta app |
| `inventarios`, `inventarios/*` | GET, POST | `PKG_INVENTARIOS_ETHOS` | `id_sucursal, items, …` | No es de esta app |

Las firmas exactas y los comentarios de cada handler están en la exportación. La forma de las respuestas (`data`, paginación) no aparece ahí: la definen los paquetes PL/SQL, que no están en este repo.

## Mis facturas (`PKG_FACTURAS_APP_ETHOS`)

El facilitador sube su factura física; el administrador la controla desde **Totales por
Facilitador** del sitio editorial-ethos-app. **Misma tabla** (`FACTURAS_FACILITADORES`) y mismas
reglas que el sitio. Script: [facturas_app_ethos.sql](facturas_app_ethos.sql), **para correr una
vez en APEX** después de `backend/cloudinary.sql` y `backend/facturas_facilitadores.sql` del
sitio (la tabla, `FOTO_URL` y `PKG_CLOUDINARY_ETHOS`).

| Método | Ruta | Envía / responde |
|---|---|---|
| GET | `mis-facturas` | `{ success, es_facilitador, fotos_habilitadas, data: [ { id_factura, nro_factura, timbrado, fecha_factura, anio, mes, fecha_desde, fecha_hasta, foto_url, revisada, cargado_el } ] }`. Las del facilitador del token, las más nuevas primero. **Sin cantidad, sueldo ni monto.** |
| POST | `mis-facturas` | `{ nro_factura, timbrado, fecha_factura, anio, mes, foto_url }` → 200 `{ id_factura, nro_factura }` · 400 `{ message, campo }` · 403 no es facilitador · 409 número repetido o mes ya facturado |
| PUT | `mis-facturas/:id` | Lo mismo; `foto_url` vacío deja la que había. 404 si no es suya · 409 si ya está revisada |
| DELETE | `mis-facturas/:id` | 404 si no es suya · 409 si ya está revisada. Sin cuerpo ni `Content-Type` (ver *CORS*) |
| POST | `mis-facturas/firma-foto` | `{ cloud_name, upload_url, campos: { api_key, timestamp, upload_preset, asset_folder, signature } }` · 503 si falta configurar Cloudinary |

- **Por revisar = `CANTIDAD = 0`.** Sin columna de estado (decisión del 04/11/2026). La app
  guarda la factura con `CANTIDAD`, `SUELDO` y `MONTO` en 0; el administrador completa cantidad y
  sueldo en el sitio y, al guardar, queda revisada (`revisada: true`). Mientras está por revisar
  el facilitador la corrige o la borra; revisada, ya no.
- **El período es un mes** (`anio`, `mes`): desde el 1 hasta el último día. No un mes que todavía
  no empezó. Una factura por mes: dos del mismo facilitador no se pisan (la misma regla del sitio;
  las dos puntas bloquean la fila de `FACILITADORES` al guardar).
- `nro_factura` se guarda siempre como `001-001-0000123` (acepta los 13 dígitos juntos o
  `1-1-123`). El mismo número con el mismo timbrado no se repite. `timbrado`, opcional y solo
  dígitos. `fecha_factura`, obligatoria y no posterior a hoy (Paraguay).
- **La foto es obligatoria en el alta.** La app la sube **directo a Cloudinary**: primero
  `POST mis-facturas/firma-foto`, después un `POST` multipart a `upload_url` con el archivo
  (`file`) y cada uno de `campos` tal cual, y el `secure_url` de la respuesta va como `foto_url`.
  El preset es Signed: la firma la hace Oracle y el secreto no sale de ahí. Solo se acepta un
  enlace de nuestro cloud. La firma vence en una hora: pedirla justo antes de subir.
- **Borrar la foto.** Después del `COMMIT`, al borrar una factura o al reemplazarle la foto, `limpiar_foto` borra de Cloudinary la foto que ya no usa ninguna factura, con `PKG_CLOUDINARY_ETHOS.borrar`.
  - Esa llamada es dinámica: el paquete compila aunque `BORRAR` no exista. El `PKG_CLOUDINARY_ETHOS` viejo no la tiene, y con la llamada directa el paquete no compilaba (`PLS-00302`).
  - Sin `BORRAR`, la factura se borra igual, la foto queda en Cloudinary y la respuesta trae `aviso`. La app no lo muestra.
  - Se arregla corriendo el `backend/cloudinary.sql` nuevo del sitio, que no pisa `CLOUDINARY_CONFIG`.
- **Salida esperada del script:** `[OK] PKG_FACTURAS_APP_ETHOS compilado`, `Handlers de mis-facturas publicados: 5 de 5`, si está `BORRAR` y si Cloudinary está configurado.

### Rutas con dos métodos

`ORDS.DEFINE_TEMPLATE` sobre una ruta que ya existe la **reemplaza y borra sus handlers**. Con dos métodos en la misma ruta (`mis-facturas` GET y POST, `mis-facturas/:id` PUT y DELETE), publicar el segundo borraba el primero: el 04/11/2026 quedaron 3 de 5. Sin el GET, el navegador mostraba un error de CORS ("authorization is not allowed").

Los scripts ahora crean la ruta **solo si no existe** (miran `USER_ORDS_TEMPLATES`). `historial_app_ethos.sql` tenía el mismo problema y quedó corregido igual.

## Mi postulación (`PKG_POSTULACION_APP_ETHOS`)

Cualquier usuario con sesión, sea o no facilitador, se postula para el año lectivo en `POSTULANTES_FACILITADORES` (formulario JV26). Ningún handler exige ser facilitador.
- El servidor pone a partir del token `USUARIO` (login en mayúsculas, columna agregada por el script) y, si es facilitador, `ID_FACILITADOR`. En las filas del formulario viejo los dos pueden quedar vacíos.
- Cada uno ve solo la suya: `ID_FACILITADOR = el suyo OR USUARIO = el suyo`.
- Hay una por usuario y año, controlada por el paquete y por el índice único `UX_POSTULANTES_FAC_USUARIO_ANIO`, que es por función e indexa solo las filas con `USUARIO`. Un alta doble a la vez responde 409.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `mi-postulacion` | `{ success, es_facilitador, anio, abierta, facilitador: { nombre, telefono, fecha_nacimiento }, postulacion?, anterior? }`. `postulacion` es la del año abierto; `anterior`, la más reciente de otro año (para precargar). Cada una trae las columnas de la tabla en minúscula, `dias_disponibles` como arreglo, `departamento`, `ciudad`, `anio` y `fecha_registro` (`YYYY-MM-DDTHH:MI`). |
| POST | `mi-postulacion` | El JSON con las mismas claves → 200 `{ id, nueva, message }` · 400 `{ message, campo }` · 409 no hay año abierto o alta doble. Se lee entero de `:body_text` con `APEX_JSON` (son ~60 campos). |
| PUT | `mi-postulacion/borrador` | `{ paso, datos, postulacion }` (los dos como texto JSON: `datos` = el formulario tal cual, `postulacion` = lo mismo que manda el `POST`) → guarda **sin validar** `datos` en `POSTULANTES_FAC_BORRADORES` (una por usuario y año, para retomar) y, si está de acuerdo con el proceso, **lo válido de `postulacion` en `POSTULANTES_FACILITADORES` con `ESTADO = 'INCOMPLETO'`** (24/11/2026), para que los administradores ya vean lo cargado: lo que falta o no es válido queda `NULL` (`leer_formulario` en modo suave). Una ya enviada **no** se pisa con datos a medias: esa corrección queda solo en el borrador hasta enviarla. Responde `{ success, visible }` (`visible`: si se escribió la fila). Sin `postulacion` (app vieja) solo guarda el borrador. Controla que sea JSON y que no pase de 200.000 caracteres. El `GET mi-postulacion` devuelve el borrador como `borrador: { paso, fecha, datos }` y **no** devuelve como `postulacion` una `INCOMPLETO`. `DELETE` descarta el borrador y también la fila `INCOMPLETO`, con sus documentos. |
| DELETE | `mi-postulacion/borrador` | Descarta lo guardado sin terminar y borra sus documentos de Cloudinary que no use ninguna postulación. |
| DELETE | `mi-postulacion` | Sin cuerpo → `{ message }`. Elimina la del año abierto (la misma que devuelve el GET) y, después del `COMMIT`, sus documentos de Cloudinary que no use otra postulación · 404 no tiene · 409 no hay año abierto, o la referencia otra tabla. |
| GET | `mi-postulacion/lugares?id_pais=` | `{ id_pais, departamentos: [ { id, nombre, ciudades: [ { id, nombre } ] } ] }`. Vacío = país 1 (Paraguay). |
| POST | `mi-postulacion/firma-documento` | Sin cuerpo → `{ cloud_name, upload_url, campos: { api_key, timestamp, upload_preset, asset_folder, signature } }` · 409 no hay año abierto · 503 Cloudinary sin configurar. Preset `fcfacilitadores`, carpeta `postulaciones-facilitadores`, `upload_url` `/auto/upload` (fotos y PDF). El `public_id` lo elige el servidor y lo anota en `POSTULANTES_FAC_ARCHIVOS`. |
| DELETE | `mi-postulacion/documento?url=` | Sin cuerpo → `{ borrado, en_uso?, aviso? }` · 400 enlace no válido · 404 no es un archivo firmado para este usuario. Si una postulación guardada lo usa, no se borra (`en_uso`). |

- **Documentos (24/11/2026):** el script **agrega a `POSTULANTES_FACILITADORES`**, si faltan, 7 columnas `VARCHAR2(500 CHAR)` que aceptan nulos: `FOTO_URL`, `CEDULA_FRENTE_URL`, `CEDULA_DORSO_URL`, `SECUNDARIO_DOC_URL`, `TECNICO_DOC_URL`, `LICENCIATURA_DOC_URL` y `POSGRADO_DOC_URL`. No cambia ninguna columna existente.
  - Las 4 columnas `CV_ARCHIVO`, `CERTIFICADO_NO_AGRESOR_ARCHIVO`, `ANTECEDENTE_JUDICIAL_ARCHIVO` y `ANTECEDENTE_POLICIAL_ARCHIVO` (`VARCHAR2(1000 CHAR)`) las creó el usuario. El script solo verifica que existan, y guardan el enlace de Cloudinary igual que las `*_URL`.
  - El POST exige siempre la foto, la cédula, el CV y los tres certificados, y el documento de cada nivel concluido o cursando. Los demás quedan `NULL`. Cada enlace tiene que ser de nuestro cloud (`PKG_CLOUDINARY_ETHOS.es_url_propia`).
  - **Firma:** el cloud y el `api_key` salen de `PKG_CLOUDINARY_ETHOS.escribir_firma`, escrita a un CLOB. La firma se rehace con el secreto de `CLOUDINARY_CONFIG` (`config('api_secret')` u otros nombres conocidos) y el preset de las postulaciones: SHA-1 de `asset_folder=…&timestamp=…&upload_preset=…` + secreto, con `STANDARD_HASH`.
  - **Al corregir**, después del `COMMIT`, se borra de Cloudinary cada documento reemplazado que ya no use ninguna postulación (`PKG_CLOUDINARY_ETHOS.borrar`, con llamada dinámica).
  - **Al quitarlo en la app**, `DELETE mi-postulacion/documento` lo borra si fue firmado para ese usuario (`POSTULANTES_FAC_ARCHIVOS`, tabla solo de la app que crea el script) y ninguna postulación lo usa. Así nadie puede borrar un archivo ajeno, por ejemplo la foto de una factura.
  - **Qué columnas escribe (24/11/2026):** el `INSERT` y el `UPDATE` (`grabar`, compartido por el envío y el guardado sin terminar) nombran solo las columnas del formulario. Guardar sin terminar deja **`ESTADO = 'INCOMPLETO'`** (`c_estado_borrador`); enviar la pasa a **`PENDIENTE`** (`c_estado_inicial`) y fija `FECHA_REGISTRO` en ese primer envío. Una corrección de una ya enviada no toca `ESTADO` ni `FECHA_REGISTRO` (solo completa `ESTADO` con `PENDIENTE` si está vacío) ni las demás columnas que maneja el administrador, que en el alta toman su `DEFAULT`. Antes se usaba `VALUES r` / `SET ROW = r`, que mandaba `NULL` en esas columnas (`ORA-01400` en `ESTADO`). El script lista con `[ERROR]` toda columna `NOT NULL` sin `DEFAULT` que la app no escriba.
  - **Ojo:** si algún proceso del sitio hace `INSERT INTO POSTULANTES_FACILITADORES VALUES (...)` sin lista de columnas, deja de funcionar con las columnas nuevas. Con la lista de columnas no pasa nada.

- **Año:** el lectivo actual (`FN_ANIO_LECTIVO_ACTUAL()`) buscado en `ANIOS_LECTIVOS`. Si no está, `anio_registrado: false`. Se cambia en un solo lugar (`anio_abierto`).
- **Período (solo lectura, se carga desde el admin):** `abierta` = `FN_POSTULACION_ABIERTA(ID_ANIO) = 'SI'`, que mira `PERIODOS_POSTULACION` (`FECHA_INICIO`–`FECHA_FIN` o `HABILITACION_EXTRAORDINARIA = 'SI'`). El `GET` manda también `periodo: { fecha_inicio, fecha_fin, extraordinaria }`.
  - `POST mi-postulacion`, `PUT mi-postulacion/borrador`, `POST mi-postulacion/firma-documento` y `DELETE mi-postulacion` responden **409** con el período cerrado. Descartar el borrador y quitar un documento propio se permiten igual: solo limpian.
  - El paquete **no escribe** en `PERIODOS_POSTULACION` ni cambia la función; el script solo verifica que existan e informa si el período está abierto.
- **Una por facilitador y año**, controlada en el paquete con la fila de `FACILITADORES` bloqueada: si ya existe, el POST la **corrige**. `FECHA_REGISTRO` queda la del primer envío, en hora de Paraguay (`SYSDATE - 3/24`; el `DEFAULT SYSTIMESTAMP` de la tabla es UTC).
- **"No de acuerdo"** no se envía: el POST solo acepta `DE_ACUERDO`.
- `EDAD` la calcula el servidor. `DIAS_DISPONIBLES` se guarda como `LUNES,MARTES,...` (sin tildes, en el orden de la semana). `UBICACION_DOMICILIO` es `latitud, longitud` del GPS o el enlace de Google Maps que pegue el facilitador.
- Valida lo mismo que los `CHECK` (cada nivel de estudio con sus códigos: `CONCLUIDA` en licenciatura, `INCONCLUSA` en licenciatura y posgrado) y lo condicional (título si está concluido o cursando, curso `2/4` si está cursando, empresa y cargo si trabaja, vehículo si tiene movilidad).
- **Salida esperada del script:** las 8 columnas (7 `*_URL` y `USUARIO`) e `UX_POSTULANTES_FAC_USUARIO_ANIO` con `[OK]`, `[OK] PKG_POSTULACION_APP_ETHOS compilado`, `Handlers de mi-postulacion publicados: 8 de 8`, `[OK] Tabla POSTULANTES_FAC_BORRADORES`, `[OK] Tabla POSTULANTES_FAC_ARCHIVOS`, `[OK] Cloudinary configurado: … (preset fcfacilitadores)` y `[OK] Postulacion abierta para <año>`. Si sale `[WARN] No se encontro el secreto…`, hacen falta los nombres de las claves de `CLOUDINARY_CONFIG`, sin los valores.

## CORS

ORDS responde el preflight del navegador por su cuenta: lo verifiqué con `auth/login`, que autoriza el origen `http://localhost:8081`. Si el navegador muestra "blocked by CORS policy", casi siempre es una URL que no existe y da 404 sin encabezados CORS: una URL de ejemplo, un módulo sin publicar o un typo. El APK no tiene esta restricción.

Detalle para las llamadas: un `DELETE` va sin cuerpo y sin `Content-Type`, porque con `Content-Type` JSON y cuerpo vacío ORDS responde 400.
