--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Historial de intervenciones": paginas 7 y 8 de APEX 193573
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_HISTORIAL_APP_ETHOS
--   2. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET historial-intervenciones        pagina 7 "Historial de Intervenciones"
--        GET historial-intervenciones/:id    pagina 8 "Observacion": carga del form + LOVs
--        PUT historial-intervenciones/:id    pagina 8: validaciones + UPDATE INTERVENCIONES
--      No pisa nada: si alguna ruta ya existe y NO es de este paquete, se detiene.
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- FIDELIDAD CON LAS PAGINAS 7 y 8
--   Pagina 7: el mismo SELECT de "Resultados de la Busqueda" (V_HISTORIAL_INTERVENCIONES,
--   :APP_USER sacado del TOKEN, ANIO = FN_ANIO_LECTIVO_ACTUAL(), ORDER BY ID_INTERVENCION
--   DESC). Las facetas Mes/Fecha y el buscador se aplican en la app sobre estas filas.
--   LOVs resueltas como en APEX: indice -> INDICES_MANUALES.TITULO, turno -> 1 Mañana,
--   2 Tarde, 3 Noche.
--   Pagina 8: mismos items (MANUAL solo lectura, ID_INDICE requerido con la LOV de la
--   pagina, SI_NO requerido Si/No, MOTIVO_DESARROLLO con DESARROLLO_MOTIVOS, OBSERVACION
--   hasta 1000 con trim) y la validacion OBS. El motivo se guarda tal como llega, aunque
--   la respuesta sea "Si" (APEX solo lo oculta). Los triggers de INTERVENCIONES corren
--   igual que con APEX.
--   Solo se edita una intervencion del facilitador del token y del año lectivo actual
--   (las que lista la pagina 7).
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_HISTORIAL_APP_ETHOS AS

  -- Pagina 7. { success, es_facilitador, data: [ { id_intervencion, fecha_hora, fecha, hora,
  --   manual, id_indice, indice, observacion, si_no, motivo_desarrollo, id_institucion,
  --   nombre, turno, turno_descripcion, grado, id_enfasis, descripcion } ] }
  -- grado viene como en la pagina: GRADO||' '||SECCION.
  PROCEDURE historial(p_token IN VARCHAR2);

  -- Pagina 8, al abrir. { success, data: { id_intervencion, manual, id_indice, si_no,
  --   motivo_desarrollo, observacion, indices:[{id_indice,titulo}], motivos:[...] } }
  PROCEDURE intervencion(p_token IN VARCHAR2, p_id_intervencion IN NUMBER);

  -- Pagina 8, boton "Aplicar Cambios".
  -- 200 { success, data:{ id_intervencion } } | 400 { success:false, message, campo } | 404
  PROCEDURE editar(
      p_token             IN VARCHAR2,
      p_id_intervencion   IN NUMBER,
      p_id_indice         IN NUMBER,
      p_si_no             IN VARCHAR2,
      p_motivo_desarrollo IN VARCHAR2,
      p_observacion       IN VARCHAR2);

END PKG_HISTORIAL_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_HISTORIAL_APP_ETHOS AS

  -- Lista de valores compartida DESARROLLO_MOTIVOS (estatica, en este orden).
  TYPE t_textos IS TABLE OF VARCHAR2(100);
  c_motivos CONSTANT t_textos := t_textos(
      'Jornada SIND', 'Lluvia', 'Feriado', 'Asueto',
      'Actividad IE', 'Personal', 'Huelga Docente', 'Otros');

-- Los encabezados CORS los pone ORDS: no repetirlos.
PROCEDURE abrir_json IS
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
END abrir_json;

PROCEDURE p_error(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2, p_campo IN VARCHAR2 DEFAULT NULL) IS
BEGIN
    OWA_UTIL.STATUS_LINE(p_status, p_reason, FALSE);
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', FALSE);
    APEX_JSON.WRITE('message', p_message);
    IF p_campo IS NOT NULL THEN
        APEX_JSON.WRITE('campo', p_campo);
    END IF;
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

-- La intervencion es del facilitador del token y del año lectivo actual (pagina 7).
FUNCTION manual_propio(p_fac IN NUMBER, p_id_intervencion IN NUMBER, o_manual OUT VARCHAR2) RETURN BOOLEAN IS
BEGIN
    SELECT MANUAL INTO o_manual
      FROM INTERVENCIONES
     WHERE ID_INTERVENCION = p_id_intervencion
       AND ID_FACILITADOR = p_fac
       AND ANIO = FN_ANIO_LECTIVO_ACTUAL();
    RETURN TRUE;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN FALSE;
END manual_propio;

PROCEDURE historial(p_token IN VARCHAR2) IS
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
            -- Pagina 7, region "Resultados de la Busqueda" (tal cual), mas FECHA_HORA
            -- para agrupar por mes y dia sin depender del idioma de TO_CHAR(..,'Month').
            select FECHA,
                   MANUAL,
                   OBSERVACION,
                   ID_INDICE,
                   (SELECT im.TITULO FROM INDICES_MANUALES im WHERE im.ID_INDICE = v.ID_INDICE) INDICE,
                   SI_NO,
                   ID_INSTITUCION,
                   NOMBRE,
                   TURNO,
                   GRADO||' '||SECCION GRADO,
                   ID_ENFASIS,
                   DESCRIPCION,
                   MES,
                   HORA,
                   id_intervencion,
                   MOTIVO_DESARROLLO,
                   TO_CHAR(FECHA_HORA, 'YYYY-MM-DD"T"HH24:MI:SS') FECHA_HORA_ISO
              from V_HISTORIAL_INTERVENCIONES v
             where ID_FACILITADOR = l_fac
               AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
             ORDER BY ID_INTERVENCION DESC
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_intervencion', r.id_intervencion);
            APEX_JSON.WRITE('fecha_hora', r.FECHA_HORA_ISO, p_write_null => TRUE);
            APEX_JSON.WRITE('fecha', r.FECHA, p_write_null => TRUE);
            APEX_JSON.WRITE('hora', r.HORA, p_write_null => TRUE);
            APEX_JSON.WRITE('manual', r.MANUAL, p_write_null => TRUE);
            APEX_JSON.WRITE('id_indice', r.ID_INDICE, p_write_null => TRUE);
            APEX_JSON.WRITE('indice', r.INDICE, p_write_null => TRUE);
            APEX_JSON.WRITE('observacion', r.OBSERVACION, p_write_null => TRUE);
            APEX_JSON.WRITE('si_no', r.SI_NO, p_write_null => TRUE);
            APEX_JSON.WRITE('motivo_desarrollo', r.MOTIVO_DESARROLLO, p_write_null => TRUE);
            APEX_JSON.WRITE('id_institucion', r.ID_INSTITUCION, p_write_null => TRUE);
            APEX_JSON.WRITE('nombre', r.NOMBRE, p_write_null => TRUE);
            APEX_JSON.WRITE('turno', r.TURNO, p_write_null => TRUE);
            APEX_JSON.WRITE('turno_descripcion',
                CASE r.TURNO WHEN 1 THEN UNISTR('Ma\00F1ana') WHEN 2 THEN 'Tarde' WHEN 3 THEN 'Noche' END,
                p_write_null => TRUE);
            APEX_JSON.WRITE('grado', TRIM(r.GRADO), p_write_null => TRUE);
            APEX_JSON.WRITE('id_enfasis', r.ID_ENFASIS, p_write_null => TRUE);
            APEX_JSON.WRITE('descripcion', r.DESCRIPCION, p_write_null => TRUE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END historial;

PROCEDURE intervencion(p_token IN VARCHAR2, p_id_intervencion IN NUMBER) IS
    l_fac    NUMBER;
    l_manual INTERVENCIONES.MANUAL%TYPE;
BEGIN
    IF NOT contexto(p_token, l_fac) THEN RETURN; END IF;
    IF l_fac IS NULL THEN
        p_error(403, 'Forbidden', 'El usuario no esta registrado como facilitador');
        RETURN;
    END IF;
    IF NOT manual_propio(l_fac, p_id_intervencion, l_manual) THEN
        p_error(404, 'Not Found', UNISTR('No se encontr\00F3 la intervenci\00F3n'));
        RETURN;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');
    -- "Inicializar pantalla Observacion" (NATIVE_FORM_INIT sobre INTERVENCIONES).
    FOR r IN (SELECT ID_INTERVENCION, MANUAL, ID_INDICE, SI_NO, MOTIVO_DESARROLLO, OBSERVACION
                FROM INTERVENCIONES
               WHERE ID_INTERVENCION = p_id_intervencion) LOOP
        APEX_JSON.WRITE('id_intervencion', r.ID_INTERVENCION);
        APEX_JSON.WRITE('manual', r.MANUAL, p_write_null => TRUE);
        APEX_JSON.WRITE('id_indice', r.ID_INDICE, p_write_null => TRUE);
        APEX_JSON.WRITE('si_no', r.SI_NO, p_write_null => TRUE);
        APEX_JSON.WRITE('motivo_desarrollo', r.MOTIVO_DESARROLLO, p_write_null => TRUE);
        APEX_JSON.WRITE('observacion', r.OBSERVACION, p_write_null => TRUE);
    END LOOP;

    -- LOV de P8_ID_INDICE (cascada de P8_MANUAL).
    APEX_JSON.OPEN_ARRAY('indices');
    FOR r IN (select titulo, id_indice
                from indices_manuales
               where nlssort(lower(manual), 'nls_sort = binary_ai') = nlssort(lower(l_manual), 'nls_sort = binary_ai')
               order by nro_indice) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id_indice', r.id_indice);
        APEX_JSON.WRITE('titulo', r.titulo);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- LOV DESARROLLO_MOTIVOS de P8_MOTIVO_DESARROLLO.
    APEX_JSON.OPEN_ARRAY('motivos');
    FOR i IN 1 .. c_motivos.COUNT LOOP
        APEX_JSON.WRITE(c_motivos(i));
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END intervencion;

PROCEDURE editar(
    p_token             IN VARCHAR2,
    p_id_intervencion   IN NUMBER,
    p_id_indice         IN NUMBER,
    p_si_no             IN VARCHAR2,
    p_motivo_desarrollo IN VARCHAR2,
    p_observacion       IN VARCHAR2) IS
    l_fac         NUMBER;
    l_manual      INTERVENCIONES.MANUAL%TYPE;
    l_n           NUMBER;
    l_motivo_ok   BOOLEAN := FALSE;
    l_observacion VARCHAR2(32767);
BEGIN
    -- P8_OBSERVACION: trim_spaces BOTH.
    l_observacion := TRIM(p_observacion);
    IF NOT contexto(p_token, l_fac) THEN RETURN; END IF;
    IF l_fac IS NULL THEN
        p_error(403, 'Forbidden', 'El usuario no esta registrado como facilitador');
        RETURN;
    END IF;
    IF NOT manual_propio(l_fac, p_id_intervencion, l_manual) THEN
        p_error(404, 'Not Found', UNISTR('No se encontr\00F3 la intervenci\00F3n'));
        RETURN;
    END IF;

    -- Requeridos de la pagina.
    IF p_id_indice IS NULL THEN
        p_error(400, 'Bad Request', UNISTR('Eleg\00ED la intervenci\00F3n (\00EDndice) del manual'), 'id_indice');
        RETURN;
    END IF;
    IF p_si_no IS NULL OR p_si_no NOT IN ('Si', 'No') THEN
        p_error(400, 'Bad Request', UNISTR('Indic\00E1 si se desarroll\00F3 la clase'), 'si_no');
        RETURN;
    END IF;

    -- Cada valor tiene que estar en su LOV (como valida APEX las listas).
    SELECT COUNT(*) INTO l_n
      FROM indices_manuales
     WHERE id_indice = p_id_indice
       AND nlssort(lower(manual), 'nls_sort = binary_ai') = nlssort(lower(l_manual), 'nls_sort = binary_ai');
    IF l_n = 0 THEN
        p_error(400, 'Bad Request', UNISTR('El \00EDndice no corresponde al manual de la intervenci\00F3n'), 'id_indice');
        RETURN;
    END IF;
    IF p_motivo_desarrollo IS NOT NULL THEN
        FOR i IN 1 .. c_motivos.COUNT LOOP
            IF c_motivos(i) = p_motivo_desarrollo THEN l_motivo_ok := TRUE; END IF;
        END LOOP;
        IF NOT l_motivo_ok THEN
            p_error(400, 'Bad Request', UNISTR('El motivo no es v\00E1lido'), 'motivo_desarrollo');
            RETURN;
        END IF;
    END IF;
    IF LENGTH(l_observacion) > 1000 THEN
        p_error(400, 'Bad Request', UNISTR('La observaci\00F3n admite hasta 1000 caracteres'), 'observacion');
        RETURN;
    END IF;

    -- Validacion OBS (tal cual).
    IF NVL(p_si_no, 'No') = 'No' AND p_motivo_desarrollo = 'Otros' THEN
        IF l_observacion IS NULL THEN
            p_error(400, 'Bad Request', UNISTR('Debe cargar una observaci\00F3n para guardar'), 'observacion');
            RETURN;
        END IF;
    END IF;

    -- "Procesar pantalla Observacion": UPDATE de los items editables del form.
    UPDATE INTERVENCIONES
       SET ID_INDICE         = p_id_indice,
           SI_NO             = p_si_no,
           MOTIVO_DESARROLLO = p_motivo_desarrollo,
           OBSERVACION       = l_observacion
     WHERE ID_INTERVENCION = p_id_intervencion
       AND ID_FACILITADOR = l_fac;
    COMMIT;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', UNISTR('Intervenci\00F3n actualizada'));
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.WRITE('id_intervencion', p_id_intervencion);
    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        -- Los RAISE_APPLICATION_ERROR de los triggers llegan con su texto.
        IF SQLCODE BETWEEN -20999 AND -20000 THEN
            p_error(400, 'Bad Request', SUBSTR(SQLERRM, 12));
        ELSE
            p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
        END IF;
END editar;

END PKG_HISTORIAL_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_HISTORIAL_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_HISTORIAL_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_HISTORIAL_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_HISTORIAL_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  TYPE t_rutas IS TABLE OF VARCHAR2(100);
  l_rutas t_rutas := t_rutas('historial-intervenciones', 'historial-intervenciones/:id');
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

  PROCEDURE publicar(p_pattern IN VARCHAR2, p_method IN VARCHAR2, p_llamada IN VARCHAR2) IS
  BEGIN
    BEGIN ORDS.DELETE_HANDLER('ethos', p_pattern, p_method); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ORDS.DEFINE_TEMPLATE(p_module_name => 'ethos', p_pattern => p_pattern, p_priority => 0, p_etag_type => 'NONE');
    EXCEPTION WHEN OTHERS THEN NULL; END;   -- ya existia (es de este paquete: se verifico antes)
    ORDS.DEFINE_HANDLER(
        p_module_name => 'ethos',
        p_pattern     => p_pattern,
        p_method      => p_method,
        p_source_type => 'plsql/block',
        p_source      => 'DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER; BEGIN' || CHR(10)
                         || c_token || '    ' || p_llamada || CHR(10) || 'END;');
    -- OBLIGATORIO por handler: sin esto :authorization llega NULL.
    ORDS.DEFINE_PARAMETER(
        p_module_name        => 'ethos',
        p_pattern            => p_pattern,
        p_method             => p_method,
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
       AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_HISTORIAL_APP_ETHOS') = 0;
    IF l_ajenos > 0 THEN
      RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/' || l_rutas(i) ||
        ' ya existe y no es de este script: no se publico nada para no pisarla.');
    END IF;
  END LOOP;

  publicar('historial-intervenciones', 'GET',
           'PKG_HISTORIAL_APP_ETHOS.HISTORIAL(p_token => l_token);');
  publicar('historial-intervenciones/:id', 'GET',
           'PKG_HISTORIAL_APP_ETHOS.INTERVENCION(p_token => l_token, p_id_intervencion => TO_NUMBER(:id));');
  publicar('historial-intervenciones/:id', 'PUT',
           'PKG_HISTORIAL_APP_ETHOS.EDITAR(p_token => l_token, p_id_intervencion => TO_NUMBER(:id), p_id_indice => TO_NUMBER(:id_indice), p_si_no => :si_no, p_motivo_desarrollo => :motivo_desarrollo, p_observacion => :observacion);');
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 3 endpoints de ethos/historial-intervenciones.');
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
     AND t.URI_TEMPLATE LIKE 'historial-intervenciones%'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_HISTORIAL_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de historial-intervenciones publicados: ' || l_n || ' de 3.');
END;
/
