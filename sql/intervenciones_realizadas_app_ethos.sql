--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Intervenciones realizadas": paginas 4, 5 y 6 de APEX 193573
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_REALIZADAS_APP_ETHOS
--   2. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET intervenciones-realizadas/instituciones   pagina 4 "Intervenciones"
--        GET intervenciones-realizadas/clases          pagina 5 "Dias"
--        GET intervenciones-realizadas/historial       pagina 6 "Manuales"
--      No pisa nada: si alguna ruta ya existe y NO es de este paquete, se detiene.
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- FIDELIDAD CON LAS PAGINAS 4, 5 y 6
--   Cada consulta es la de la region APEX, sin cambios de logica. :APP_USER,
--   :P5_ID_FACILITADOR y :P6_ID_FACILITADOR salen del TOKEN, nunca del cliente.
--   Las LOVs de la pagina se resuelven igual que en APEX:
--     Enfasis (pag. 5) -> ENFASIS.DESCRIPCION por ID_ENFASIS
--     Turno   (pag. 5) -> 1 Mañana, 2 Tarde, 3 Noche
--     Indice  (pag. 6) -> INDICES_MANUALES.TITULO por ID_INDICE
--   Agregados de la app (no cambian las filas de las paginas):
--     - Contadores por institucion y por clase: marcaciones y SI_NO = 'Si'.
--     - Pagina 5 ordenada por turno, grado y seccion.
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_REALIZADAS_APP_ETHOS AS

  -- Pagina 4. { success, es_facilitador, data: [ { id_institucion, nombre_institucion,
  --   marcaciones, desarrolladas } ] }
  PROCEDURE instituciones(p_token IN VARCHAR2);

  -- Pagina 5. { success, es_facilitador, data: {
  --   filas:   [ { id_postulacion, turno, turno_descripcion, grado, seccion, id_enfasis, enfasis,
  --                lunes, martes, miercoles, jueves, viernes } ],
  --   resumen: [ { turno, grado, seccion, marcaciones, desarrolladas } ] } }
  -- En resumen, seccion es NVL(SECCION,'A'): la misma clave con la que filtra la pagina 6.
  PROCEDURE clases(p_token IN VARCHAR2, p_id_institucion IN NUMBER);

  -- Pagina 6. { success, es_facilitador, data: [ { id_intervencion, fecha_hora, manual,
  --   id_indice, indice, observacion, desarrollo } ] }
  PROCEDURE historial(p_token IN VARCHAR2, p_id_institucion IN NUMBER, p_turno IN NUMBER,
                      p_grado IN VARCHAR2, p_seccion IN VARCHAR2);

END PKG_REALIZADAS_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_REALIZADAS_APP_ETHOS AS

-- Constantes antes que cualquier procedimiento del body.
c_miercoles CONSTANT VARCHAR2(20) := UNISTR('mi\00E9rcoles');

-- Los encabezados CORS los pone ORDS: no repetirlos.
PROCEDURE abrir_json IS
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
END abrir_json;

PROCEDURE p_error(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2) IS
BEGIN
    OWA_UTIL.STATUS_LINE(p_status, p_reason, FALSE);
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', FALSE);
    APEX_JSON.WRITE('message', p_message);
    APEX_JSON.CLOSE_OBJECT;
END p_error;

-- Escribe el 401 y devuelve FALSE si el token no sirve.
-- o_id_facilitador = SELECT ID_FACILITADOR FROM FACILITADORES WHERE USUARIO = :APP_USER
FUNCTION contexto(p_token IN VARCHAR2, o_id_facilitador OUT NUMBER) RETURN BOOLEAN IS
    l_usuario VARCHAR2(255);
BEGIN
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN FALSE;
    END IF;
    BEGIN
        SELECT ID_FACILITADOR INTO o_id_facilitador FROM FACILITADORES
         WHERE UPPER(TRIM(USUARIO)) = UPPER(TRIM(l_usuario));
    EXCEPTION
        WHEN NO_DATA_FOUND THEN o_id_facilitador := NULL;
    END;
    RETURN TRUE;
END contexto;

FUNCTION turno_descripcion(p_turno IN NUMBER) RETURN VARCHAR2 IS
BEGIN
    RETURN CASE p_turno WHEN 1 THEN UNISTR('Ma\00F1ana') WHEN 2 THEN 'Tarde' WHEN 3 THEN 'Noche' END;
END turno_descripcion;

PROCEDURE instituciones(p_token IN VARCHAR2) IS
    l_fac NUMBER;
BEGIN
    IF NOT contexto(p_token, l_fac) THEN RETURN; END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.OPEN_ARRAY('data');
    IF l_fac IS NOT NULL THEN
        FOR r IN (
            SELECT x.NOMBRE_INSTITUCION, x.ID_INSTITUCION,
                   (SELECT COUNT(*) FROM INTERVENCIONES i
                     WHERE i.ID_FACILITADOR = l_fac
                       AND i.ID_INSTITUCION = x.ID_INSTITUCION
                       AND i.ANIO = FN_ANIO_LECTIVO_ACTUAL()) marcaciones,
                   (SELECT COUNT(*) FROM INTERVENCIONES i
                     WHERE i.ID_FACILITADOR = l_fac
                       AND i.ID_INSTITUCION = x.ID_INSTITUCION
                       AND i.ANIO = FN_ANIO_LECTIVO_ACTUAL()
                       AND NVL(i.SI_NO, 'No') = 'Si') desarrolladas
              FROM (
                    -- Pagina 4, region INSTITUCIONES (tal cual).
                    SELECT DISTINCT nombre_institucion, id_institucion, id_facilitador
                      FROM V_POSTULACIONES
                     WHERE ID_FACILITADOR = l_fac
                       AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
                   ) x
             ORDER BY x.NOMBRE_INSTITUCION
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_institucion', r.ID_INSTITUCION);
            APEX_JSON.WRITE('nombre_institucion', r.NOMBRE_INSTITUCION, p_write_null => TRUE);
            APEX_JSON.WRITE('marcaciones', r.marcaciones);
            APEX_JSON.WRITE('desarrolladas', r.desarrolladas);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END instituciones;

PROCEDURE clases(p_token IN VARCHAR2, p_id_institucion IN NUMBER) IS
    l_fac NUMBER;
BEGIN
    IF NOT contexto(p_token, l_fac) THEN RETURN; END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.OPEN_OBJECT('data');

    APEX_JSON.OPEN_ARRAY('filas');
    IF l_fac IS NOT NULL THEN
        FOR r IN (
            SELECT x.*,
                   (SELECT e.DESCRIPCION FROM ENFASIS e WHERE e.ID_ENFASIS = x.id_enfasis) enfasis
              FROM (
                    -- Pagina 5, region Intervenciones (tal cual).
                    select distinct id_facilitador,
                           id_institucion,
                           turno,
                           id_postulacion,
                           case when lower(to_char(fecha_hora, 'fmday', 'NLS_DATE_LANGUAGE=SPANISH')) = 'lunes'     then grado||' '||seccion end as lunes,
                           case when lower(to_char(fecha_hora, 'fmday', 'NLS_DATE_LANGUAGE=SPANISH')) = 'martes'    then grado||' '||seccion end as martes,
                           case when lower(to_char(fecha_hora, 'fmday', 'NLS_DATE_LANGUAGE=SPANISH')) = c_miercoles then grado||' '||seccion end as miercoles,
                           case when lower(to_char(fecha_hora, 'fmday', 'NLS_DATE_LANGUAGE=SPANISH')) = 'jueves'    then grado||' '||seccion end as jueves,
                           case when lower(to_char(fecha_hora, 'fmday', 'NLS_DATE_LANGUAGE=SPANISH')) = 'viernes'   then grado||' '||seccion end as viernes,
                           grado,
                           seccion,
                           turno id_turno,
                           id_enfasis
                      from intervenciones
                     where id_facilitador = l_fac
                       and id_institucion = p_id_institucion
                       AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
                   ) x
             ORDER BY x.turno, x.grado, x.seccion
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_postulacion', r.id_postulacion);
            APEX_JSON.WRITE('turno', r.turno, p_write_null => TRUE);
            APEX_JSON.WRITE('turno_descripcion', turno_descripcion(r.turno), p_write_null => TRUE);
            APEX_JSON.WRITE('grado', r.grado, p_write_null => TRUE);
            APEX_JSON.WRITE('seccion', r.seccion, p_write_null => TRUE);
            APEX_JSON.WRITE('id_enfasis', r.id_enfasis, p_write_null => TRUE);
            APEX_JSON.WRITE('enfasis', r.enfasis, p_write_null => TRUE);
            APEX_JSON.WRITE('lunes', r.lunes, p_write_null => TRUE);
            APEX_JSON.WRITE('martes', r.martes, p_write_null => TRUE);
            APEX_JSON.WRITE('miercoles', r.miercoles, p_write_null => TRUE);
            APEX_JSON.WRITE('jueves', r.jueves, p_write_null => TRUE);
            APEX_JSON.WRITE('viernes', r.viernes, p_write_null => TRUE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;

    -- Contadores por clase, con la misma clave que filtra la pagina 6.
    APEX_JSON.OPEN_ARRAY('resumen');
    IF l_fac IS NOT NULL THEN
        FOR r IN (
            SELECT turno, grado, NVL(seccion, 'A') seccion,
                   COUNT(*) marcaciones,
                   COUNT(CASE WHEN NVL(si_no, 'No') = 'Si' THEN 1 END) desarrolladas
              FROM INTERVENCIONES
             WHERE id_facilitador = l_fac
               AND id_institucion = p_id_institucion
               AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
             GROUP BY turno, grado, NVL(seccion, 'A')
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('turno', r.turno, p_write_null => TRUE);
            APEX_JSON.WRITE('grado', r.grado, p_write_null => TRUE);
            APEX_JSON.WRITE('seccion', r.seccion);
            APEX_JSON.WRITE('marcaciones', r.marcaciones);
            APEX_JSON.WRITE('desarrolladas', r.desarrolladas);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END clases;

PROCEDURE historial(p_token IN VARCHAR2, p_id_institucion IN NUMBER, p_turno IN NUMBER,
                    p_grado IN VARCHAR2, p_seccion IN VARCHAR2) IS
    l_fac NUMBER;
BEGIN
    IF NOT contexto(p_token, l_fac) THEN RETURN; END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.OPEN_ARRAY('data');
    IF l_fac IS NOT NULL THEN
        FOR r IN (
            -- Pagina 6, region datos (tal cual), con la LOV del indice resuelta.
            select ID_INTERVENCION,
                   to_char(fecha_hora, 'YYYY-MM-DD"T"HH24:MI:SS') fecha_hora,
                   manual,
                   id_indice,
                   (SELECT im.TITULO FROM INDICES_MANUALES im WHERE im.ID_INDICE = i.id_indice) indice,
                   observacion,
                   si_no desarrollo
              from INTERVENCIONES i
             where id_institucion = p_id_institucion
               and id_facilitador = l_fac
               and turno = p_turno
               and grado = p_grado
               and nvl(SECCION, 'A') = nvl(p_seccion, 'A')
               AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
             order by to_number(ID_INTERVENCION) desc
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_intervencion', r.ID_INTERVENCION);
            APEX_JSON.WRITE('fecha_hora', r.fecha_hora, p_write_null => TRUE);
            APEX_JSON.WRITE('manual', r.manual, p_write_null => TRUE);
            APEX_JSON.WRITE('id_indice', r.id_indice, p_write_null => TRUE);
            APEX_JSON.WRITE('indice', r.indice, p_write_null => TRUE);
            APEX_JSON.WRITE('observacion', r.observacion, p_write_null => TRUE);
            APEX_JSON.WRITE('desarrollo', r.desarrollo, p_write_null => TRUE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END historial;

END PKG_REALIZADAS_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_REALIZADAS_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_REALIZADAS_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_REALIZADAS_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_REALIZADAS_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  TYPE t_rutas IS TABLE OF VARCHAR2(100);
  l_rutas t_rutas := t_rutas(
      'intervenciones-realizadas/instituciones',
      'intervenciones-realizadas/clases',
      'intervenciones-realizadas/historial');
  l_modulo NUMBER;
  l_ajenos NUMBER;

  -- Saca el token del header Authorization (mismo patron que el resto del modulo).
  c_token CONSTANT VARCHAR2(400) :=
'    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), ''BEARER '');
        IF l_pos > 0 THEN
            l_token := TRIM(SUBSTR(l_token, l_pos + 7));
        END IF;
    END IF;
';

  PROCEDURE publicar(p_pattern IN VARCHAR2, p_llamada IN VARCHAR2) IS
  BEGIN
    BEGIN ORDS.DELETE_HANDLER('ethos', p_pattern, 'GET'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ORDS.DEFINE_TEMPLATE(p_module_name => 'ethos', p_pattern => p_pattern, p_priority => 0, p_etag_type => 'NONE');
    EXCEPTION WHEN OTHERS THEN NULL; END;   -- ya existia (es de este paquete: se verifico antes)
    ORDS.DEFINE_HANDLER(
        p_module_name => 'ethos',
        p_pattern     => p_pattern,
        p_method      => 'GET',
        p_source_type => 'plsql/block',
        p_source      => 'DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER; BEGIN' || CHR(10)
                         || c_token || '    ' || p_llamada || CHR(10) || 'END;');
    -- OBLIGATORIO por handler: sin esto :authorization llega NULL.
    ORDS.DEFINE_PARAMETER(
        p_module_name        => 'ethos',
        p_pattern            => p_pattern,
        p_method             => 'GET',
        p_name               => 'Authorization',
        p_bind_variable_name => 'authorization',
        p_source_type        => 'HEADER',
        p_param_type         => 'STRING',
        p_access_method      => 'IN');
  END publicar;
BEGIN
  SELECT COUNT(*) INTO l_modulo FROM USER_ORDS_MODULES WHERE NAME = 'ethos';
  IF l_modulo = 0 THEN
    RAISE_APPLICATION_ERROR(-20000, 'No existe el modulo ORDS ethos en este esquema: no se publico nada.');
  END IF;

  -- NO PISAR: si alguna ruta ya existe con un handler que no es de este paquete, no se toca nada.
  FOR i IN 1 .. l_rutas.COUNT LOOP
    SELECT COUNT(*) INTO l_ajenos
      FROM USER_ORDS_HANDLERS h
      JOIN USER_ORDS_TEMPLATES t ON t.ID = h.TEMPLATE_ID
      JOIN USER_ORDS_MODULES   m ON m.ID = t.MODULE_ID
     WHERE m.NAME = 'ethos'
       AND t.URI_TEMPLATE = l_rutas(i)
       AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_REALIZADAS_APP_ETHOS') = 0;
    IF l_ajenos > 0 THEN
      RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/' || l_rutas(i) ||
        ' ya existe y no es de este script: no se publico nada para no pisarla.');
    END IF;
  END LOOP;

  publicar('intervenciones-realizadas/instituciones',
           'PKG_REALIZADAS_APP_ETHOS.INSTITUCIONES(p_token => l_token);');
  publicar('intervenciones-realizadas/clases',
           'PKG_REALIZADAS_APP_ETHOS.CLASES(p_token => l_token, p_id_institucion => TO_NUMBER(:id_institucion));');
  publicar('intervenciones-realizadas/historial',
           'PKG_REALIZADAS_APP_ETHOS.HISTORIAL(p_token => l_token, p_id_institucion => TO_NUMBER(:id_institucion), p_turno => TO_NUMBER(:turno), p_grado => :grado, p_seccion => :seccion);');
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 3 endpoints de ethos/intervenciones-realizadas.');
END;
/

--------------------------------------------------------------------------------
-- 3. VERIFICACION
--------------------------------------------------------------------------------

DECLARE
  l_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_n
    FROM USER_ORDS_HANDLERS h
    JOIN USER_ORDS_TEMPLATES t ON t.ID = h.TEMPLATE_ID
    JOIN USER_ORDS_MODULES   m ON m.ID = t.MODULE_ID
   WHERE m.NAME = 'ethos'
     AND t.URI_TEMPLATE LIKE 'intervenciones-realizadas/%'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_REALIZADAS_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de intervenciones-realizadas publicados: ' || l_n || ' de 3.');
END;
/
