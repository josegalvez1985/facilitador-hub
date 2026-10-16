--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Mis horarios": pagina 3 "Agenda" de APEX 193573
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_AGENDA_APP_ETHOS
--   2. Endpoint EXCLUSIVO en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET mi-agenda    region "Resultados de la Busqueda" de la pagina 3
--      No pisa nada: si la ruta ya existe y NO es de este paquete, se detiene.
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- FIDELIDAD CON LA PAGINA 3
--   Mismo SELECT, mismos filtros y mismo ORDER BY. :APP_USER sale del TOKEN.
--   TURNO se devuelve tambien con su descripcion (LOV de la pagina: 1 Mañana,
--   2 Tarde, 3 Noche).
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_AGENDA_APP_ETHOS AS

  -- { success, es_facilitador, data: [ { id_institucion, nombre_institucion, turno,
  --   turno_descripcion, grado, lunes, martes, miercoles, jueves, viernes, seccion,
  --   nombre_profesor, id_enfasis, enfasis, id_materia, manual, estado,
  --   id_postulacion, anio, departamento, ciudad } ] }
  -- Los dias vienen como en V_AGENDA: 'hh24:mi, hh24:mi', o ', ' si ese dia no hay clase.
  -- Ademas, por clase: indice_siguiente / nro_indice_siguiente (el siguiente al ultimo
  -- desarrollado), indices_desarrollados e indices_total del manual.
  PROCEDURE mi_agenda(p_token IN VARCHAR2);

END PKG_AGENDA_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_AGENDA_APP_ETHOS AS

-- TRANSLATE de la pagina 2 (LOV de P2_ID_INDICE) para comparar el manual.
-- (Las constantes van antes que cualquier procedimiento del body.)
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

-- Indice siguiente al ULTIMO desarrollado (SI_NO = 'Si') en la postulacion, dentro
-- de su manual. Sin ninguno desarrollado: el primero del manual. Si ya se desarrollo
-- el ultimo, o_titulo queda NULL (manual completado).
PROCEDURE indice_siguiente(
    p_id_postulacion IN  NUMBER,
    p_manual         IN  VARCHAR2,
    o_titulo         OUT VARCHAR2,
    o_nro            OUT NUMBER,
    o_desarrollados  OUT NUMBER,
    o_total          OUT NUMBER)
IS
    l_ultimo NUMBER;
BEGIN
    o_titulo := NULL; o_nro := NULL; o_desarrollados := 0; o_total := 0;
    IF p_manual IS NULL THEN RETURN; END IF;

    SELECT COUNT(*) INTO o_total
      FROM INDICES_MANUALES im
     WHERE TRANSLATE(UPPER(im.MANUAL), c_con_tildes, c_sin_tildes) = p_manual;

    SELECT MAX(im.NRO_INDICE), COUNT(DISTINCT im.ID_INDICE)
      INTO l_ultimo, o_desarrollados
      FROM INTERVENCIONES i, INDICES_MANUALES im
     WHERE i.ID_POSTULACION = p_id_postulacion
       AND NVL(i.SI_NO, 'No') = 'Si'
       AND im.ID_INDICE = i.ID_INDICE
       AND TRANSLATE(UPPER(im.MANUAL), c_con_tildes, c_sin_tildes) = p_manual;

    BEGIN
        SELECT im.TITULO, im.NRO_INDICE
          INTO o_titulo, o_nro
          FROM INDICES_MANUALES im
         WHERE TRANSLATE(UPPER(im.MANUAL), c_con_tildes, c_sin_tildes) = p_manual
           AND (l_ultimo IS NULL OR im.NRO_INDICE > l_ultimo)
         ORDER BY im.NRO_INDICE ASC
         FETCH FIRST 1 ROWS ONLY;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN o_titulo := NULL; o_nro := NULL;
    END;
END indice_siguiente;

PROCEDURE mi_agenda(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
    l_titulo  VARCHAR2(500);
    l_nro     NUMBER;
    l_hechos  NUMBER;
    l_total   NUMBER;
BEGIN
    -- :APP_USER de la pagina = usuario del token.
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN;
    END IF;

    -- DA "id_facilitador" de la pagina (solo informativo: el reporte filtra por USUARIO).
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

    -- Region "Resultados de la Busqueda" de la pagina 3, sin cambios de logica.
    FOR r IN (
        select *
          from V_AGENDA A
         WHERE UPPER(A.USUARIO) = UPPER(l_usuario)
           AND NVL(A.ESTADO, 'Activo') = 'Activo'
           AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
         order by turno asc, lunes asc, martes asc, miercoles asc, jueves asc, viernes asc, grado asc
    ) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id_institucion',     r.ID_INSTITUCION);
        APEX_JSON.WRITE('nombre_institucion', r.NOMBRE_INSTITUCION, p_write_null => TRUE);
        APEX_JSON.WRITE('turno',              r.TURNO, p_write_null => TRUE);
        APEX_JSON.WRITE('turno_descripcion',
            CASE r.TURNO WHEN 1 THEN UNISTR('Ma\00F1ana') WHEN 2 THEN 'Tarde' WHEN 3 THEN 'Noche' END,
            p_write_null => TRUE);
        APEX_JSON.WRITE('grado',              r.GRADO,     p_write_null => TRUE);
        APEX_JSON.WRITE('lunes',              r.LUNES,     p_write_null => TRUE);
        APEX_JSON.WRITE('martes',             r.MARTES,    p_write_null => TRUE);
        APEX_JSON.WRITE('miercoles',          r.MIERCOLES, p_write_null => TRUE);
        APEX_JSON.WRITE('jueves',             r.JUEVES,    p_write_null => TRUE);
        APEX_JSON.WRITE('viernes',            r.VIERNES,   p_write_null => TRUE);
        APEX_JSON.WRITE('seccion',            r.SECCION,   p_write_null => TRUE);
        APEX_JSON.WRITE('nombre_profesor',    r.NOMBRE_PROFESOR, p_write_null => TRUE);
        APEX_JSON.WRITE('id_enfasis',         r.ID_ENFASIS, p_write_null => TRUE);
        APEX_JSON.WRITE('enfasis',            r.ENFASIS,   p_write_null => TRUE);
        APEX_JSON.WRITE('id_materia',         r.ID_MATERIA, p_write_null => TRUE);
        APEX_JSON.WRITE('manual',             r.MANUAL,    p_write_null => TRUE);
        APEX_JSON.WRITE('estado',             r.ESTADO,    p_write_null => TRUE);
        APEX_JSON.WRITE('id_postulacion',     r.ID_POSTULACION);
        APEX_JSON.WRITE('anio',               r.ANIO,      p_write_null => TRUE);
        APEX_JSON.WRITE('departamento',       r.DEPARTAMENTO, p_write_null => TRUE);
        APEX_JSON.WRITE('ciudad',             r.CIUDAD,    p_write_null => TRUE);

        indice_siguiente(r.ID_POSTULACION, r.MANUAL, l_titulo, l_nro, l_hechos, l_total);
        APEX_JSON.WRITE('indice_siguiente',      l_titulo, p_write_null => TRUE);
        APEX_JSON.WRITE('nro_indice_siguiente',  l_nro,    p_write_null => TRUE);
        APEX_JSON.WRITE('indices_desarrollados', l_hechos);
        APEX_JSON.WRITE('indices_total',         l_total);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;

    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END mi_agenda;

END PKG_AGENDA_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_AGENDA_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_AGENDA_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_AGENDA_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_AGENDA_APP_ETHOS compilado.');
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
     AND t.URI_TEMPLATE = 'mi-agenda'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_AGENDA_APP_ETHOS') = 0;
  IF l_ajenos > 0 THEN
    RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/mi-agenda ya existe y no es de este script: no se publico nada.');
  END IF;

  BEGIN ORDS.DELETE_HANDLER('ethos', 'mi-agenda', 'GET'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ORDS.DEFINE_TEMPLATE(p_module_name => 'ethos', p_pattern => 'mi-agenda', p_priority => 0, p_etag_type => 'NONE');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ORDS.DEFINE_HANDLER(
      p_module_name => 'ethos',
      p_pattern     => 'mi-agenda',
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
    PKG_AGENDA_APP_ETHOS.MI_AGENDA(p_token => l_token);
END;');

  -- OBLIGATORIO por handler: sin esto :authorization llega NULL.
  ORDS.DEFINE_PARAMETER(
      p_module_name        => 'ethos',
      p_pattern            => 'mi-agenda',
      p_method             => 'GET',
      p_name               => 'Authorization',
      p_bind_variable_name => 'authorization',
      p_source_type        => 'HEADER',
      p_param_type         => 'STRING',
      p_access_method      => 'IN');

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicado GET ethos/mi-agenda.');
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
     AND t.URI_TEMPLATE = 'mi-agenda'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_AGENDA_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handler de mi-agenda publicado: ' || l_n || ' de 1.');
END;
/
