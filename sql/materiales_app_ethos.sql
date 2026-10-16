--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Mis materiales": manuales e indices del facilitador
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_MATERIALES_APP_ETHOS
--   2. Endpoint EXCLUSIVO en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET mis-materiales
--      No pisa nada: si la ruta ya existe y NO es de este paquete, se detiene.
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- QUE DEVUELVE
--   Por cada postulacion del facilitador del token en el año lectivo actual
--   (V_AGENDA, cualquier estado: tambien las 'Finalizado'), su manual con TODOS
--   los indices de INDICES_MANUALES, marcando los desarrollados (alguna
--   INTERVENCION con SI_NO = 'Si' en esa postulacion) y su fecha.
--   El manual se compara con el mismo TRANSLATE(UPPER(...)) de la pagina 2.
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_MATERIALES_APP_ETHOS AS

  -- { success, es_facilitador, data: [ { id_postulacion, institucion, grado, seccion,
  --   turno, turno_descripcion, manual, estado,
  --   indices: [ { id_indice, nro_indice, titulo, desarrollado, fecha_desarrollo } ] } ] }
  PROCEDURE mis_materiales(p_token IN VARCHAR2);

END PKG_MATERIALES_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_MATERIALES_APP_ETHOS AS

-- Constantes antes que cualquier procedimiento del body.
c_con_tildes CONSTANT VARCHAR2(64) :=
    UNISTR('\00C1\00C9\00CD\00D3\00DA\00D1\00C0\00C8\00CC\00D2\00D9\00C4\00CB\00CF\00D6\00DC');
c_sin_tildes CONSTANT VARCHAR2(64) := 'AEIOUNAEOUAEIOU';

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

PROCEDURE mis_materiales(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
BEGIN
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN;
    END IF;

    BEGIN
        SELECT ID_FACILITADOR INTO l_fac FROM FACILITADORES
         WHERE UPPER(TRIM(USUARIO)) = UPPER(TRIM(l_usuario));
    EXCEPTION
        WHEN OTHERS THEN l_fac := NULL;
    END;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.OPEN_ARRAY('data');

    IF l_fac IS NOT NULL THEN
        FOR p IN (
            SELECT A.ID_POSTULACION, A.NOMBRE_INSTITUCION, A.GRADO, A.SECCION, A.TURNO, A.MANUAL, A.ESTADO
              FROM V_AGENDA A
             WHERE UPPER(A.USUARIO) = UPPER(l_usuario)
               AND A.ANIO = FN_ANIO_LECTIVO_ACTUAL()
               AND A.MANUAL IS NOT NULL
             ORDER BY A.MANUAL, A.NOMBRE_INSTITUCION, A.TURNO, A.GRADO
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_postulacion', p.ID_POSTULACION);
            APEX_JSON.WRITE('institucion', p.NOMBRE_INSTITUCION, p_write_null => TRUE);
            APEX_JSON.WRITE('grado', p.GRADO, p_write_null => TRUE);
            APEX_JSON.WRITE('seccion', p.SECCION, p_write_null => TRUE);
            APEX_JSON.WRITE('turno', p.TURNO, p_write_null => TRUE);
            APEX_JSON.WRITE('turno_descripcion',
                CASE p.TURNO WHEN 1 THEN UNISTR('Ma\00F1ana') WHEN 2 THEN 'Tarde' WHEN 3 THEN 'Noche' END,
                p_write_null => TRUE);
            APEX_JSON.WRITE('manual', p.MANUAL);
            APEX_JSON.WRITE('estado', p.ESTADO, p_write_null => TRUE);

            APEX_JSON.OPEN_ARRAY('indices');
            FOR i IN (
                SELECT im.ID_INDICE, im.NRO_INDICE, im.TITULO,
                       (SELECT MAX(x.FECHA_HORA)
                          FROM INTERVENCIONES x
                         WHERE x.ID_POSTULACION = p.ID_POSTULACION
                           AND x.ID_INDICE = im.ID_INDICE
                           AND NVL(x.SI_NO, 'No') = 'Si') fecha
                  FROM INDICES_MANUALES im
                 WHERE TRANSLATE(UPPER(im.MANUAL), c_con_tildes, c_sin_tildes) = p.MANUAL
                 ORDER BY im.NRO_INDICE ASC
            ) LOOP
                APEX_JSON.OPEN_OBJECT;
                APEX_JSON.WRITE('id_indice', i.ID_INDICE);
                APEX_JSON.WRITE('nro_indice', i.NRO_INDICE);
                APEX_JSON.WRITE('titulo', i.TITULO);
                APEX_JSON.WRITE('desarrollado', i.fecha IS NOT NULL);
                APEX_JSON.WRITE('fecha_desarrollo', TO_CHAR(i.fecha, 'YYYY-MM-DD"T"HH24:MI:SS'), p_write_null => TRUE);
                APEX_JSON.CLOSE_OBJECT;
            END LOOP;
            APEX_JSON.CLOSE_ARRAY;

            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;

    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END mis_materiales;

END PKG_MATERIALES_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_MATERIALES_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_MATERIALES_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_MATERIALES_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_MATERIALES_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINT (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  l_modulo NUMBER;
  l_ajenos NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_modulo FROM USER_ORDS_MODULES WHERE NAME = 'ethos';
  IF l_modulo = 0 THEN
    RAISE_APPLICATION_ERROR(-20000, 'No existe el modulo ORDS ethos en este esquema: no se publico nada.');
  END IF;

  -- NO PISAR: si la ruta ya existe con un handler que no es de este paquete, no se toca.
  SELECT COUNT(*) INTO l_ajenos
    FROM USER_ORDS_HANDLERS h
    JOIN USER_ORDS_TEMPLATES t ON t.ID = h.TEMPLATE_ID
    JOIN USER_ORDS_MODULES   m ON m.ID = t.MODULE_ID
   WHERE m.NAME = 'ethos'
     AND t.URI_TEMPLATE = 'mis-materiales'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_MATERIALES_APP_ETHOS') = 0;
  IF l_ajenos > 0 THEN
    RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/mis-materiales ya existe y no es de este script: no se publico nada.');
  END IF;

  BEGIN ORDS.DELETE_HANDLER('ethos', 'mis-materiales', 'GET'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ORDS.DEFINE_TEMPLATE(p_module_name => 'ethos', p_pattern => 'mis-materiales', p_priority => 0, p_etag_type => 'NONE');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ORDS.DEFINE_HANDLER(
      p_module_name => 'ethos',
      p_pattern     => 'mis-materiales',
      p_method      => 'GET',
      p_source_type => 'plsql/block',
      p_source      =>
'DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER; BEGIN
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), ''BEARER '');
        IF l_pos > 0 THEN
            l_token := TRIM(SUBSTR(l_token, l_pos + 7));
        END IF;
    END IF;
    PKG_MATERIALES_APP_ETHOS.MIS_MATERIALES(p_token => l_token);
END;');

  -- OBLIGATORIO por handler: sin esto :authorization llega NULL.
  ORDS.DEFINE_PARAMETER(
      p_module_name        => 'ethos',
      p_pattern            => 'mis-materiales',
      p_method             => 'GET',
      p_name               => 'Authorization',
      p_bind_variable_name => 'authorization',
      p_source_type        => 'HEADER',
      p_param_type         => 'STRING',
      p_access_method      => 'IN');

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicado GET ethos/mis-materiales.');
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
     AND t.URI_TEMPLATE = 'mis-materiales'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_MATERIALES_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handler de mis-materiales publicado: ' || l_n || ' de 1.');
END;
/
