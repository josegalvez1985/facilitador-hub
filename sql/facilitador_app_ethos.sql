--------------------------------------------------------------------------------
-- Facilitadores (app movil) — endpoints del facilitador logueado
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_FACILITADOR_APP_ETHOS
--   2. Endpoints en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET  mi-facilitador     -> ID_FACILITADOR del usuario del token
--        GET  mis-evaluaciones   -> pagina 11 de APEX ("Evaluaciones")
--        GET  cumpleanios-hoy    -> facilitadores que cumplen anios hoy (Inicio)
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC). No toca tablas ni los demas endpoints.
--
-- AISLAMIENTO ENTRE FACILITADORES
--   El ID_FACILITADOR NUNCA viene del cliente: se calcula en el servidor a
--   partir del token (PKG_AUTH_ETHOS.validar_token -> USUARIO -> FACILITADORES),
--   igual que las paginas APEX con :APP_USER. Un facilitador no puede pedir
--   datos de otro aunque manipule la URL.
--
--   EXCEPCION ACOTADA: cumpleanios-hoy muestra a todos los facilitadores que
--   cumplen hoy (pedido explicito). Devuelve SOLO el nombre: nunca la fecha de
--   nacimiento, la edad, el id, el usuario ni otro dato de FACILITADORES.
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_FACILITADOR_APP_ETHOS AS

  -- { success, data: { usuario, id_facilitador, es_facilitador } }
  -- 401 si el token no sirve.
  PROCEDURE mi_facilitador(p_token IN VARCHAR2);

  -- Pagina 11 "Evaluaciones" de la app APEX 193573, para el facilitador del token.
  -- { success, es_facilitador, data: [ { fecha_desde, aspectos_positivos,
  --   aspectos_mejorar, marcadas, calificacion, puntuacion, indicador } ] }
  PROCEDURE mis_evaluaciones(p_token IN VARCHAR2);

  -- Cumpleanios del dia (hora de Paraguay) de los facilitadores activos.
  -- { success, data: [ { nombre, soy_yo } ] }. Solo para usuarios facilitadores.
  PROCEDURE cumpleanios_hoy(p_token IN VARCHAR2);

END PKG_FACILITADOR_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_FACILITADOR_APP_ETHOS AS

------------------------------------------------------------------------------
-- Helpers de respuesta
------------------------------------------------------------------------------

-- Los encabezados CORS los agrega ORDS: no repetirlos aca (duplicados = el
-- navegador rechaza la respuesta).
PROCEDURE abrir_json IS
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
END abrir_json;

-- STATUS_LINE va ANTES de MIME_HEADER, si no el status se pierde.
PROCEDURE p_error(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2) IS
BEGIN
    OWA_UTIL.STATUS_LINE(p_status, p_reason, FALSE);
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', FALSE);
    APEX_JSON.WRITE('message', p_message);
    APEX_JSON.CLOSE_OBJECT;
END p_error;

------------------------------------------------------------------------------
-- ID_FACILITADOR del usuario: mismo calculo que la pagina APEX
--   SELECT ID_FACILITADOR FROM FACILITADORES WHERE USUARIO = :APP_USER
-- NO_DATA_FOUND -> NULL. Dos filas para el mismo usuario -> error: antes que
-- elegir una al azar (y mezclar datos), se corta.
------------------------------------------------------------------------------
FUNCTION id_facilitador(p_usuario IN VARCHAR2) RETURN NUMBER IS
    l_id NUMBER;
BEGIN
    SELECT ID_FACILITADOR
      INTO l_id
      FROM FACILITADORES
     WHERE UPPER(TRIM(USUARIO)) = UPPER(TRIM(p_usuario));
    RETURN l_id;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
    WHEN TOO_MANY_ROWS THEN
        RAISE_APPLICATION_ERROR(-20001,
            'Error FACILITADORES. El usuario ' || p_usuario || ' esta asociado a mas de un facilitador.');
END id_facilitador;

------------------------------------------------------------------------------
-- API publica
------------------------------------------------------------------------------

PROCEDURE mi_facilitador(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
    l_id      NUMBER;
BEGIN
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN;
    END IF;

    l_id := id_facilitador(l_usuario);

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.WRITE('usuario', l_usuario);
    APEX_JSON.WRITE('id_facilitador', l_id, p_write_null => TRUE);
    APEX_JSON.WRITE('es_facilitador', l_id IS NOT NULL);
    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        p_error(500, 'Internal Server Error',
                CASE WHEN SQLCODE = -20001 THEN SUBSTR(SQLERRM, 12)
                     ELSE 'Error FACILITADORES. ' || SQLERRM END);
END mi_facilitador;

PROCEDURE mis_evaluaciones(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
    l_id      NUMBER;
BEGIN
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN;
    END IF;

    l_id := id_facilitador(l_usuario);

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_id IS NOT NULL);
    APEX_JSON.OPEN_ARRAY('data');

    -- Sin facilitador no hay filas (como la pagina APEX con P11_ID_FACILITADOR nulo).
    IF l_id IS NOT NULL THEN
        -- Consulta de la region "Evaluaciones" de la pagina 11, sin cambios de logica.
        FOR r IN (
            select e.fecha_desde,
                   e.aspectos_positivos,
                   e.aspectos_mejorar,
                   e.marcadas,
                   es.calificacion,
                   es.escala || '/33' puntuacion,
                   es.descripcion indicador
            from (
                  select a.fecha_desde,
                         max(cast(a.aspectos_positivos as varchar2(4000))) as aspectos_positivos,
                         max(cast(a.aspectos_mejorar   as varchar2(4000))) as aspectos_mejorar,
                         count(case when a.id_area is not null
                                     and a.id_evaluacion is not null
                                     and a.escala = 1 then 1 end)          as marcadas
                  from EVALUACIONES_FACILITADORES a
                  where a.id_facilitador = l_id
                  group by a.id_institucion,
                           a.fecha_desde,
                           a.fecha_hasta,
                           lower(trim(a.evaluado_por))
                  having max(nvl(a.ind_cerrado, 'N')) = 'S'
                 ) e
            left join escalas_evaluaciones es
                   on es.escala = least(e.marcadas,
                                        (select max(escala) from escalas_evaluaciones))
            order by e.fecha_desde desc
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('fecha_desde',        r.fecha_desde);
            APEX_JSON.WRITE('aspectos_positivos', r.aspectos_positivos, p_write_null => TRUE);
            APEX_JSON.WRITE('aspectos_mejorar',   r.aspectos_mejorar,   p_write_null => TRUE);
            APEX_JSON.WRITE('marcadas',           r.marcadas);
            APEX_JSON.WRITE('calificacion',       r.calificacion,       p_write_null => TRUE);
            APEX_JSON.WRITE('puntuacion',         r.puntuacion,         p_write_null => TRUE);
            APEX_JSON.WRITE('indicador',          r.indicador,          p_write_null => TRUE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;

    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        p_error(500, 'Internal Server Error',
                CASE WHEN SQLCODE = -20001 THEN SUBSTR(SQLERRM, 12)
                     ELSE 'Error: ' || SQLERRM END);
END mis_evaluaciones;

PROCEDURE cumpleanios_hoy(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
    l_id      NUMBER;
    -- Hoy en Paraguay, igual que FECHA_HORA de INTERVENCIONES (SYSDATE - 3/24).
    l_hoy     DATE := TRUNC(SYSDATE - (3/24));
    -- Anio no bisiesto: los nacidos un 29/02 se saludan el 28/02.
    l_bisiesto BOOLEAN := TO_CHAR(LAST_DAY(TO_DATE(TO_CHAR(l_hoy, 'YYYY') || '0201', 'YYYYMMDD')), 'DD') = '29';
    l_mmdd    VARCHAR2(4) := TO_CHAR(l_hoy, 'MMDD');
    l_feb28   VARCHAR2(1) := CASE WHEN l_mmdd = '0228' AND NOT l_bisiesto THEN 'S' ELSE 'N' END;
BEGIN
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN;
    END IF;

    l_id := id_facilitador(l_usuario);

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_id IS NOT NULL);
    APEX_JSON.OPEN_ARRAY('data');
    IF l_id IS NOT NULL THEN
        -- 'MMDD' es numerico: no depende del idioma de la sesion (ORDS no esta en espanol).
        -- ACTIVO: se excluyen los marcados como inactivos ('N', 'No', 'I', 'Inactivo'...).
        FOR r IN (
            SELECT f.NOMBRE_APELLIDO,
                   CASE WHEN f.ID_FACILITADOR = l_id THEN 1 ELSE 0 END AS soy_yo
              FROM FACILITADORES f
             WHERE f.FECHA_NACIMIENTO IS NOT NULL
               AND NVL(UPPER(SUBSTR(TRIM(f.ACTIVO), 1, 1)), 'S') NOT IN ('N', 'I')
               AND (TO_CHAR(f.FECHA_NACIMIENTO, 'MMDD') = l_mmdd
                    OR (l_feb28 = 'S' AND TO_CHAR(f.FECHA_NACIMIENTO, 'MMDD') = '0229'))
             ORDER BY soy_yo DESC, f.NOMBRE_APELLIDO
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('nombre', r.NOMBRE_APELLIDO);
            APEX_JSON.WRITE('soy_yo', r.soy_yo = 1);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        p_error(500, 'Internal Server Error',
                CASE WHEN SQLCODE = -20001 THEN SUBSTR(SQLERRM, 12)
                     ELSE 'Error: ' || SQLERRM END);
END cumpleanios_hoy;

END PKG_FACILITADOR_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_FACILITADOR_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_FACILITADOR_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_FACILITADOR_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_FACILITADOR_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE, que lo
--    borraria con todos sus endpoints)
--------------------------------------------------------------------------------

DECLARE
  l_modulo NUMBER;

  PROCEDURE publicar(p_pattern IN VARCHAR2, p_procedimiento IN VARCHAR2) IS
  BEGIN
    BEGIN ORDS.DELETE_HANDLER('ethos', p_pattern, 'GET'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ORDS.DEFINE_TEMPLATE(
          p_module_name => 'ethos',
          p_pattern     => p_pattern,
          p_priority    => 0,
          p_etag_type   => 'NONE');
    EXCEPTION WHEN OTHERS THEN NULL; END;   -- ya existia

    ORDS.DEFINE_HANDLER(
        p_module_name => 'ethos',
        p_pattern     => p_pattern,
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
    PKG_FACILITADOR_APP_ETHOS.' || p_procedimiento || '(p_token => l_token);
END;');

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

  publicar('mi-facilitador',   'MI_FACILITADOR');
  publicar('mis-evaluaciones', 'MIS_EVALUACIONES');
  publicar('cumpleanios-hoy',  'CUMPLEANIOS_HOY');
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados GET ethos/mi-facilitador, mis-evaluaciones y cumpleanios-hoy.');
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
     AND t.URI_TEMPLATE IN ('mi-facilitador', 'mis-evaluaciones', 'cumpleanios-hoy')
     AND h.METHOD = 'GET';
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers nuevos publicados: ' || l_n || ' de 3.');
  -- Para confirmar el filtro de ACTIVO: que los valores "inactivos" empiecen con N o I.
  DBMS_OUTPUT.PUT_LINE('[INFO] Valores de FACILITADORES.ACTIVO:');
  FOR v IN (SELECT NVL(ACTIVO, '(vacio)') valor, COUNT(*) n FROM FACILITADORES GROUP BY ACTIVO ORDER BY 2 DESC) LOOP
    DBMS_OUTPUT.PUT_LINE('         ' || v.valor || ': ' || v.n);
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('Probar (con un token de auth/login):');
  DBMS_OUTPUT.PUT_LINE('  curl -H "Authorization: Bearer TOKEN" https://oracleapex.com/ords/fundcarac/ethos/mi-facilitador');
  DBMS_OUTPUT.PUT_LINE('  curl -H "Authorization: Bearer TOKEN" https://oracleapex.com/ords/fundcarac/ethos/mis-evaluaciones');
END;
/
