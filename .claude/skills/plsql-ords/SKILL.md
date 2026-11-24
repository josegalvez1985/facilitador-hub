---
name: plsql-ords
description: Cómo escribir paquetes PL/SQL PKG_*_APP_ETHOS y publicar handlers en el módulo ORDS ethos sin romper lo publicado (script idempotente, validación de token, JSON con APEX_JSON, DEFINE_TEMPLATE seguro, verificación, rollback). Usar al crear o modificar cualquier script de sql/ o endpoint del backend.
---

# PL/SQL + ORDS en este proyecto

Backend: Oracle APEX / ORDS, esquema `WKSP_FUNDCARAC`, módulo publicado `ethos`. Los scripts los ejecuta **el usuario** en APEX → SQL Workshop → SQL Scripts. Nunca se ejecutan desde acá.

Referencia completa y corta: `sql/materiales_app_ethos.sql`. Copiá su estructura, con una excepción: ese script llama a `ORDS.DEFINE_TEMPLATE` sin comprobar antes si la plantilla existe (sirve porque su ruta tiene un solo método). En scripts nuevos, comprobalo siempre (ver abajo).

## Estructura de un script `sql/<area>_app_ethos.sql`
1. Encabezado: qué crea, cómo correrlo, qué devuelve, página APEX de origen.
2. `SET SERVEROUTPUT ON` / `SET DEFINE OFF`.
3. `CREATE OR REPLACE PACKAGE` con el contrato JSON comentado sobre cada procedimiento.
4. `CREATE OR REPLACE PACKAGE BODY`:
   - **Constantes y tipos antes de cualquier procedimiento** (si no, no compila).
   - `abrir_json` y `p_error(status, reason, message)` locales. Los encabezados CORS los pone ORDS: no repetirlos.
   - Cada procedimiento recibe `p_token`, valida con `PKG_AUTH_ETHOS.validar_token(p_token)`; si es NULL → `p_error(401, 'Unauthorized', 'Token invalido o expirado')`.
   - El facilitador sale del usuario del token (`FACILITADORES.USUARIO`). El cliente nunca manda un id de facilitador.
   - `EXCEPTION WHEN OTHERS THEN p_error(500, …)`.
5. Bloque que revisa `USER_ERRORS` e imprime `[OK]` o los errores de compilación.
6. Publicación del endpoint (ver abajo).
7. Bloque de verificación que cuenta los handlers publicados.

## Publicar un handler sin romper nada
- **Nunca** `ORDS.DEFINE_MODULE` (borra el módulo entero).
- Verificar que el módulo `ethos` existe en `USER_ORDS_MODULES`; si no, `RAISE_APPLICATION_ERROR`.
- Si la ruta ya existe con un handler que no es de este paquete (`DBMS_LOB.INSTR(h.SOURCE, 'PKG_…') = 0`), detenerse.
- `ORDS.DEFINE_TEMPLATE` **solo si la plantilla no existe** (consultar `USER_ORDS_TEMPLATES` con `URI_TEMPLATE = '<ruta>'`). Sobre una plantilla existente la reemplaza y borra todos sus handlers: una ruta con GET + PUT queda solo con el último (pasó con `mis-facturas`).
- `ORDS.DELETE_HANDLER` + `ORDS.DEFINE_HANDLER` solo del método que se está publicando.
- Handler `plsql/block` que extrae el token de `:authorization` (quitando `Bearer `) y llama al paquete.
- `ORDS.DEFINE_PARAMETER` con `p_name => 'Authorization'`, `p_source_type => 'HEADER'` **por cada handler**; sin esto `:authorization` llega NULL.
- Cuerpo de POST/PUT: leer con `:body_text` o `APEX_JSON.PARSE`. DELETE sin cuerpo (ORDS responde 400 si el cliente manda cuerpo o `Content-Type`).

## Reglas de datos
- Semántica idéntica a la página APEX que se porta; citar la consulta original en un comentario.
- Fechas a texto de día/mes: `TO_CHAR(f, 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH')`. ORDS no corre en español.
- Fechas en JSON: `TO_CHAR(f, 'YYYY-MM-DD"T"HH24:MI:SS')`.
- No modificar vistas, tablas ni funciones que usa APEX: crear copias `*_APP_ETHOS`.
- Escrituras: nombrar solo las columnas del formulario (nunca `VALUES r` / `SET ROW`) para no pisar columnas administrativas.
- Binds siempre; nada de SQL dinámico con concatenación de entradas del usuario.
- Respuestas mínimas: solo las columnas que la pantalla muestra. Nada de fechas de nacimiento, montos u otros datos que la regla del endpoint excluya.
- Tablas que administra el sitio (ej. `PERIODOS_POSTULACION`): solo lectura.

## DDL (tablas, columnas, índices)
- Idempotente: comprobar en `USER_TABLES` / `USER_TAB_COLUMNS` / `USER_INDEXES` antes de crear.
- Columnas nuevas en tablas compartidas: nulas y solo con aprobación del usuario.
- Incluir al final, comentado, el script de rollback (`DROP` de lo creado por este script, nunca de objetos previos).

## Después
- Documentar en `sql/README.md`: método, ruta, cabeceras, parámetros, ejemplo de respuesta, errores.
- Avisar al usuario: "este cambio requiere ejecutar `sql/<archivo>.sql` en APEX".
