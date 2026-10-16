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
| [agenda_app_ethos.sql](agenda_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_AGENDA_APP_ETHOS` (Mis horarios, página 3) y publica `GET mi-agenda`. No pisa rutas existentes. |
| [intervenciones_app_ethos.sql](intervenciones_app_ethos.sql) | **Para correr una vez en APEX.** Crea `PKG_INTERVENCIONES_APP_ETHOS` (Marcar, página 2) y publica `mis-intervenciones/*`. No pisa rutas existentes: si alguna ya existe y no es de este paquete, se detiene sin tocar nada. |

Nada de esto se ejecuta desde la app.

## Endpoints de la app (`PKG_FACILITADOR_APP_ETHOS`)

Los dos sacan el `ID_FACILITADOR` **del token**, en el servidor (`FACILITADORES.USUARIO = usuario del token`, igual que `:APP_USER` en APEX). El cliente nunca manda el id: un facilitador no puede ver datos de otro aunque modifique la URL.

| Método | Ruta | Responde |
|---|---|---|
| GET | `mi-facilitador` | `{ success, data: { usuario, id_facilitador, es_facilitador } }`. `id_facilitador: null` si el usuario no está en `FACILITADORES`; 401 si el token no sirve. |
| GET | `mis-evaluaciones` | Página 11 de APEX: `{ success, es_facilitador, data: [ { fecha_desde, aspectos_positivos, aspectos_mejorar, marcadas, calificacion, puntuacion, indicador } ] }` |

Cómo instalarlo: APEX → SQL Workshop → SQL Scripts → Upload `facilitador_app_ethos.sql` → Run, con el usuario dueño del esquema. La salida debe decir `[OK] PKG_FACILITADOR_APP_ETHOS compilado` y `Handlers nuevos publicados: 2 de 2`.

## Mis horarios: agenda (`PKG_AGENDA_APP_ETHOS`)

Página 3 "Agenda" de APEX. `GET mi-agenda` corre el mismo SELECT del reporte (`V_AGENDA` con `USUARIO = :APP_USER`, `ESTADO` Activo, `ANIO = FN_ANIO_LECTIVO_ACTUAL()`, mismo `ORDER BY`), con el usuario sacado del token.

Responde `{ success, es_facilitador, data: [ { id_institucion, nombre_institucion, turno, turno_descripcion, grado, lunes … viernes, seccion, nombre_profesor, id_enfasis, enfasis, id_materia, manual, estado, id_postulacion, anio, departamento, ciudad } ] }`. Los días vienen como en la vista: `"08:20, 09:00"`, o `", "` si ese día no hay clase. `turno_descripcion` sigue la LOV de la página: 1 Mañana, 2 Tarde, 3 Noche.

## Marcar: intervenciones (`PKG_INTERVENCIONES_APP_ETHOS`)

Corresponde a la página 2 "Intervención" de APEX. Cada GET corre **el mismo select** del ítem APEX, y `:P2_ID_FACILITADOR` / `:APP_USER` salen del token.

| Método | Ruta | Equivale a | Responde (`data`) |
|---|---|---|---|
| GET | `mis-intervenciones/inicio` | LOV y default de `P2_ID_INSTITUCION`, LOV `DESARROLLO_MOTIVOS` | `{ es_facilitador, instituciones:[{id,nombre}], institucion_por_defecto, motivos:[…], requiere_ubicacion }` |
| GET | `mis-intervenciones/horarios?id_institucion=` | LOV de `P2_ID_POSTULACION` | `[ { id_postulacion, horario } ]` |
| GET | `mis-intervenciones/clase?id_institucion=&id_postulacion=` | LOVs de `P2_GRADO`, `P2_SECCION`, `P2_TURNO`, `P2_ID_ENFASIS`, `P2_MANUAL` | `{ grados, secciones, turnos:[{turno,descripcion}], enfasis:[{id_enfasis,descripcion}], manuales }` |
| GET | `mis-intervenciones/indices?id_postulacion=&manual=&grado=&turno=` | LOV y default de `P2_ID_INDICE` | `{ indices:[{id_indice,titulo}], indice_por_defecto }` |
| GET | `mis-intervenciones/resumen` | KPI "Marcaciones del mes" de Inicio | `{ es_facilitador, del_mes, desarrolladas_del_mes, mes }` |
| POST | `mis-intervenciones` | Botón Guardar (validaciones + INSERT) | 200 `{ id_intervencion }` · 400 `{ message, campo }` · 403 si no es facilitador |

Validaciones del POST:
- Los obligatorios de la página.
- Cada valor tiene que estar en su lista. Esto asegura también que la institución y la postulación son del facilitador.
- `TRG_INTERV_SINO_MOTIVO`: motivo obligatorio cuando la respuesta es No.
- `OBS`: observación obligatoria con "No" + "Otros".
- Ubicación: obligatoria salvo `IND_UBICACION_POSTULACION = 'NO'`.

`FECHA_HORA` (hora de Paraguay, `SYSDATE - 3/24`), `ANIO`, `ID_AUDITORIA` y la finalización de la postulación los ponen los triggers de `INTERVENCIONES`, como con APEX. La auditoría registra al usuario del token, porque `validar_token` lo deja en `CLIENT_IDENTIFIER`.

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

## CORS

ORDS responde el preflight del navegador por su cuenta: lo verifiqué con `auth/login`, que autoriza el origen `http://localhost:8081`. Si el navegador muestra "blocked by CORS policy", casi siempre es una URL que no existe y da 404 sin encabezados CORS: una URL de ejemplo, un módulo sin publicar o un typo. El APK no tiene esta restricción.

Detalle para las llamadas: un `DELETE` va sin cuerpo y sin `Content-Type`, porque con `Content-Type` JSON y cuerpo vacío ORDS responde 400.
