--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Marcar": pagina 2 "Intervencion" de APEX 193573
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   0. Vista V_INSTITUCIONES_APP_ETHOS (copia de V_INSTITUCIONES solo para la app)
--   1. Paquete PKG_INTERVENCIONES_APP_ETHOS
--   2. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se
--      redefine). No pisa ningun endpoint existente: si alguna de estas rutas
--      ya existe y NO es de este paquete, el script se detiene sin tocar nada.
--        GET  mis-intervenciones/inicio      instituciones, motivos, ubicacion
--        GET  mis-intervenciones/horarios    LOV P2_ID_POSTULACION
--        GET  mis-intervenciones/clase       LOVs grado/seccion/turno/enfasis/manual
--        GET  mis-intervenciones/indices     LOV + default P2_ID_INDICE
--        GET  mis-intervenciones/resumen     KPI "Marcaciones del mes" (Inicio)
--        GET  mis-intervenciones/recientes   "Actividad reciente" (Inicio)
--        POST mis-intervenciones             validaciones + INSERT INTERVENCIONES
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- FIDELIDAD CON LA PAGINA 2
--   Cada consulta es la del item APEX correspondiente, sin cambios de logica
--   (incluido el valor por defecto de P2_ID_INDICE y de P2_ID_INSTITUCION).
--   :P2_ID_FACILITADOR y :APP_USER salen del TOKEN, nunca del cliente.
--   FECHA_HORA, ANIO, ID_AUDITORIA y la ubicacion en 0 los siguen poniendo los
--   triggers de INTERVENCIONES, igual que con APEX.
--   Unica diferencia: se lee V_INSTITUCIONES_APP_ETHOS en vez de V_INSTITUCIONES
--   (ver seccion 0). Mismas filas, pero sin depender del idioma de la sesion.
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 0. VISTA V_INSTITUCIONES_APP_ETHOS
--------------------------------------------------------------------------------
-- Copia EXACTA de V_INSTITUCIONES (DDL del 16/10/2026) con un solo cambio:
-- el dia de hoy se calcula con TO_CHAR(.., 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH').
--
-- Por que: V_INSTITUCIONES solo trae las clases de HOY y compara el dia con
-- TO_CHAR(.., 'FMDAY'), que sale en el idioma de la sesion. En APEX (espanol)
-- da 'VIERNES' y coincide; en ORDS, la sesion de la app, da 'FRIDAY' y la
-- vista queda vacia: Marcar no mostraba instituciones ni horarios.
--
-- V_INSTITUCIONES NO SE TOCA: la sigue usando APEX tal cual. Esta copia la usa
-- solo PKG_INTERVENCIONES_APP_ETHOS. Si alguna vez cambia V_INSTITUCIONES,
-- hay que repetir el cambio aca.
--------------------------------------------------------------------------------

CREATE OR REPLACE VIEW V_INSTITUCIONES_APP_ETHOS
  (ID_INSTITUCION, NOMBRE, ID_FACILITADOR, HORA_DESDE, HORA_HASTA, DIA, GRADO, MANUAL,
   TURNO, ID_POSTULACION, SECCION, ID_ENFASIS, ESTADO, ANIO, ESTADO_INSTITUCION) AS
select ID_INSTITUCION, NOMBRE, ID_FACILITADOR, HORA_DESDE, HORA_HASTA, DIA, GRADO, MANUAL, TURNO,
       ID_POSTULACION, SECCION, ID_ENFASIS, ESTADO, ANIO, ESTADO_INSTITUCION
  from (
        -- LUNES
        select A.ID_INSTITUCION, B.NOMBRE, A.ID_FACILITADOR, A.LUNES_DESDE HORA_DESDE, A.LUNES_HASTA HORA_HASTA, 'LUNES' DIA,
               CASE WHEN "3" IS NOT NULL THEN '3º' WHEN "4" IS NOT NULL THEN '4º' WHEN "5" IS NOT NULL THEN '5º'
                    WHEN "6" IS NOT NULL THEN '6º' WHEN "7" IS NOT NULL THEN '7º' WHEN "8" IS NOT NULL THEN '8º'
                    WHEN "9" IS NOT NULL THEN '9º' WHEN "1M" IS NOT NULL THEN '1M' WHEN "2M" IS NOT NULL THEN '2M'
                    WHEN "3M" IS NOT NULL THEN '3M' ELSE '0' END AS GRADO,
               CASE WHEN SER IS NOT NULL THEN 'SER' WHEN HACER IS NOT NULL THEN 'HACER' WHEN TENER IS NOT NULL THEN 'TENER'
                    WHEN CARACTER IS NOT NULL THEN 'CARACTER' WHEN VISION IS NOT NULL THEN 'VISION'
                    WHEN CORAJE IS NOT NULL THEN 'CORAJE' WHEN LIDERAZGO IS NOT NULL THEN 'LIDERAZGO' ELSE '0' END AS MANUAL,
               A.TURNO, A.ID_POSTULACION, A.SECCION, A.ID_ENFASIS,
               CASE WHEN A.ESTADO IS NULL THEN 'Activo' ELSE A.ESTADO END AS ESTADO,
               A.ANIO, NVL(B.ESTADO,'I') ESTADO_INSTITUCION
          from POSTULACIONES A, INSTITUCIONES B
         where LUNES_DESDE IS NOT NULL
           and 'LUNES' = UPPER(TRANSLATE(TO_CHAR(trunc(SYSDATE - (3/24)), 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH'),'ÁÉÍÓÚÑÀÈÌÒÙÄËÏÖÜ','AEIOUNAEOUAEIOU'))
           AND A.ID_INSTITUCION = B.ID_INSTITUCION
        UNION ALL
        -- MARTES
        select A.ID_INSTITUCION, B.NOMBRE, A.ID_FACILITADOR, A.MARTES_DESDE, A.MARTES_HASTA, 'MARTES',
               CASE WHEN "3" IS NOT NULL THEN '3º' WHEN "4" IS NOT NULL THEN '4º' WHEN "5" IS NOT NULL THEN '5º'
                    WHEN "6" IS NOT NULL THEN '6º' WHEN "7" IS NOT NULL THEN '7º' WHEN "8" IS NOT NULL THEN '8º'
                    WHEN "9" IS NOT NULL THEN '9º' WHEN "1M" IS NOT NULL THEN '1M' WHEN "2M" IS NOT NULL THEN '2M'
                    WHEN "3M" IS NOT NULL THEN '3M' ELSE '0' END AS GRADO,
               CASE WHEN SER IS NOT NULL THEN 'SER' WHEN HACER IS NOT NULL THEN 'HACER' WHEN TENER IS NOT NULL THEN 'TENER'
                    WHEN CARACTER IS NOT NULL THEN 'CARACTER' WHEN VISION IS NOT NULL THEN 'VISION'
                    WHEN CORAJE IS NOT NULL THEN 'CORAJE' WHEN LIDERAZGO IS NOT NULL THEN 'LIDERAZGO' ELSE '0' END AS MANUAL,
               A.TURNO, A.ID_POSTULACION, A.SECCION, A.ID_ENFASIS,
               CASE WHEN A.ESTADO IS NULL THEN 'Activo' ELSE A.ESTADO END,
               A.ANIO, NVL(B.ESTADO,'I') ESTADO_INSTITUCION
          from POSTULACIONES A, INSTITUCIONES B
         where MARTES_DESDE IS NOT NULL
           and 'MARTES' = UPPER(TRANSLATE(TO_CHAR(trunc(SYSDATE - (3/24)), 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH'),'ÁÉÍÓÚÑÀÈÌÒÙÄËÏÖÜ','AEIOUNAEOUAEIOU'))
           AND A.ID_INSTITUCION = B.ID_INSTITUCION
        UNION ALL
        -- MIERCOLES
        select A.ID_INSTITUCION, B.NOMBRE, A.ID_FACILITADOR, A.MIERCOLES_DESDE, A.MIERCOLES_HASTA, 'MIERCOLES',
               CASE WHEN "3" IS NOT NULL THEN '3º' WHEN "4" IS NOT NULL THEN '4º' WHEN "5" IS NOT NULL THEN '5º'
                    WHEN "6" IS NOT NULL THEN '6º' WHEN "7" IS NOT NULL THEN '7º' WHEN "8" IS NOT NULL THEN '8º'
                    WHEN "9" IS NOT NULL THEN '9º' WHEN "1M" IS NOT NULL THEN '1M' WHEN "2M" IS NOT NULL THEN '2M'
                    WHEN "3M" IS NOT NULL THEN '3M' ELSE '0' END AS GRADO,
               CASE WHEN SER IS NOT NULL THEN 'SER' WHEN HACER IS NOT NULL THEN 'HACER' WHEN TENER IS NOT NULL THEN 'TENER'
                    WHEN CARACTER IS NOT NULL THEN 'CARACTER' WHEN VISION IS NOT NULL THEN 'VISION'
                    WHEN CORAJE IS NOT NULL THEN 'CORAJE' WHEN LIDERAZGO IS NOT NULL THEN 'LIDERAZGO' ELSE '0' END AS MANUAL,
               A.TURNO, A.ID_POSTULACION, A.SECCION, A.ID_ENFASIS,
               CASE WHEN A.ESTADO IS NULL THEN 'Activo' ELSE A.ESTADO END,
               A.ANIO, NVL(B.ESTADO,'I') ESTADO_INSTITUCION
          from POSTULACIONES A, INSTITUCIONES B
         where MIERCOLES_DESDE IS NOT NULL
           and 'MIERCOLES' = UPPER(TRANSLATE(TO_CHAR(trunc(SYSDATE - (3/24)), 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH'),'ÁÉÍÓÚÑÀÈÌÒÙÄËÏÖÜ','AEIOUNAEOUAEIOU'))
           AND A.ID_INSTITUCION = B.ID_INSTITUCION
        UNION ALL
        -- JUEVES
        select A.ID_INSTITUCION, B.NOMBRE, A.ID_FACILITADOR, A.JUEVES_DESDE, A.JUEVES_HASTA, 'JUEVES',
               CASE WHEN "3" IS NOT NULL THEN '3º' WHEN "4" IS NOT NULL THEN '4º' WHEN "5" IS NOT NULL THEN '5º'
                    WHEN "6" IS NOT NULL THEN '6º' WHEN "7" IS NOT NULL THEN '7º' WHEN "8" IS NOT NULL THEN '8º'
                    WHEN "9" IS NOT NULL THEN '9º' WHEN "1M" IS NOT NULL THEN '1M' WHEN "2M" IS NOT NULL THEN '2M'
                    WHEN "3M" IS NOT NULL THEN '3M' ELSE '0' END AS GRADO,
               CASE WHEN SER IS NOT NULL THEN 'SER' WHEN HACER IS NOT NULL THEN 'HACER' WHEN TENER IS NOT NULL THEN 'TENER'
                    WHEN CARACTER IS NOT NULL THEN 'CARACTER' WHEN VISION IS NOT NULL THEN 'VISION'
                    WHEN CORAJE IS NOT NULL THEN 'CORAJE' WHEN LIDERAZGO IS NOT NULL THEN 'LIDERAZGO' ELSE '0' END AS MANUAL,
               A.TURNO, A.ID_POSTULACION, A.SECCION, A.ID_ENFASIS,
               CASE WHEN A.ESTADO IS NULL THEN 'Activo' ELSE A.ESTADO END,
               A.ANIO, NVL(B.ESTADO,'I') ESTADO_INSTITUCION
          from POSTULACIONES A, INSTITUCIONES B
         where JUEVES_DESDE IS NOT NULL
           and 'JUEVES' = UPPER(TRANSLATE(TO_CHAR(trunc(SYSDATE - (3/24)), 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH'),'ÁÉÍÓÚÑÀÈÌÒÙÄËÏÖÜ','AEIOUNAEOUAEIOU'))
           AND A.ID_INSTITUCION = B.ID_INSTITUCION
        UNION ALL
        -- VIERNES
        select A.ID_INSTITUCION, B.NOMBRE, A.ID_FACILITADOR, A.VIERNES_DESDE, A.VIERNES_HASTA, 'VIERNES',
               CASE WHEN "3" IS NOT NULL THEN '3º' WHEN "4" IS NOT NULL THEN '4º' WHEN "5" IS NOT NULL THEN '5º'
                    WHEN "6" IS NOT NULL THEN '6º' WHEN "7" IS NOT NULL THEN '7º' WHEN "8" IS NOT NULL THEN '8º'
                    WHEN "9" IS NOT NULL THEN '9º' WHEN "1M" IS NOT NULL THEN '1M' WHEN "2M" IS NOT NULL THEN '2M'
                    WHEN "3M" IS NOT NULL THEN '3M' ELSE '0' END AS GRADO,
               CASE WHEN SER IS NOT NULL THEN 'SER' WHEN HACER IS NOT NULL THEN 'HACER' WHEN TENER IS NOT NULL THEN 'TENER'
                    WHEN CARACTER IS NOT NULL THEN 'CARACTER' WHEN VISION IS NOT NULL THEN 'VISION'
                    WHEN CORAJE IS NOT NULL THEN 'CORAJE' WHEN LIDERAZGO IS NOT NULL THEN 'LIDERAZGO' ELSE '0' END AS MANUAL,
               A.TURNO, A.ID_POSTULACION, A.SECCION, A.ID_ENFASIS,
               CASE WHEN A.ESTADO IS NULL THEN 'Activo' ELSE A.ESTADO END,
               A.ANIO, NVL(B.ESTADO,'I') ESTADO_INSTITUCION
          from POSTULACIONES A, INSTITUCIONES B
         where A.VIERNES_DESDE IS NOT NULL
           and 'VIERNES' = UPPER(TRANSLATE(TO_CHAR(trunc(SYSDATE - (3/24)), 'FMDAY', 'NLS_DATE_LANGUAGE=SPANISH'),'ÁÉÍÓÚÑÀÈÌÒÙÄËÏÖÜ','AEIOUNAEOUAEIOU'))
           AND A.ID_INSTITUCION = B.ID_INSTITUCION
       )
 order by HORA_DESDE asc
/

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_INTERVENCIONES_APP_ETHOS AS

  -- { success, data: { instituciones:[{id,nombre}], institucion_por_defecto,
  --   motivos:[...], requiere_ubicacion } }
  PROCEDURE inicio(p_token IN VARCHAR2);

  -- { success, data: [ { id_postulacion, horario } ] }
  PROCEDURE horarios(p_token IN VARCHAR2, p_id_institucion IN NUMBER);

  -- { success, data: { grados:[], secciones:[], turnos:[{turno,descripcion}],
  --   enfasis:[{id_enfasis,descripcion}], manuales:[] } }
  PROCEDURE clase(p_token IN VARCHAR2, p_id_institucion IN NUMBER, p_id_postulacion IN NUMBER);

  -- { success, data: { indices:[{id_indice,titulo}], indice_por_defecto } }
  PROCEDURE indices(p_token IN VARCHAR2, p_id_postulacion IN NUMBER, p_manual IN VARCHAR2,
                    p_grado IN VARCHAR2, p_turno IN NUMBER);

  -- KPI "Marcaciones del mes" de la app: intervenciones del facilitador del token
  -- en el mes actual, mas los KPIs Instituciones y Materiales desarrollados.
  -- { success, data:{ es_facilitador, del_mes, desarrolladas_del_mes, mes, instituciones,
  --   indices_desarrollados, manuales_desarrollados } }
  PROCEDURE resumen(p_token IN VARCHAR2);

  -- "Actividad reciente" de Inicio: ultimas intervenciones del facilitador del token.
  -- { success, data:[ { id_intervencion, fecha_hora, si_no, motivo_desarrollo, manual,
  --   indice, institucion, grado, seccion } ] }
  PROCEDURE recientes(p_token IN VARCHAR2, p_limite IN NUMBER DEFAULT 5);

  -- Valida como la pagina (requeridos, LOVs, OBS, triggers) e inserta.
  -- 200 { success, data:{ id_intervencion } } | 400 { success:false, message, campo }
  PROCEDURE guardar(
      p_token             IN VARCHAR2,
      p_id_institucion    IN NUMBER,
      p_id_postulacion    IN NUMBER,
      p_grado             IN VARCHAR2,
      p_seccion           IN VARCHAR2,
      p_turno             IN NUMBER,
      p_id_enfasis        IN NUMBER,
      p_manual            IN VARCHAR2,
      p_id_indice         IN NUMBER,
      p_si_no             IN VARCHAR2,
      p_motivo_desarrollo IN VARCHAR2,
      p_observacion       IN VARCHAR2,
      p_latitud           IN VARCHAR2,
      p_longitud          IN VARCHAR2);

END PKG_INTERVENCIONES_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_INTERVENCIONES_APP_ETHOS AS

  -- Lista de valores compartida DESARROLLO_MOTIVOS (estatica, en este orden).
  TYPE t_textos IS TABLE OF VARCHAR2(100);
  c_motivos CONSTANT t_textos := t_textos(
      'Jornada SIND', 'Lluvia', 'Feriado', 'Asueto',
      'Actividad IE', 'Personal', 'Huelga Docente', 'Otros');

  -- TRANSLATE de la pagina APEX (LOV y default de P2_ID_INDICE).
  c_con_tildes CONSTANT VARCHAR2(64) :=
      UNISTR('\00C1\00C9\00CD\00D3\00DA\00D1\00C0\00C8\00CC\00D2\00D9\00C4\00CB\00CF\00D6\00DC');
  c_sin_tildes CONSTANT VARCHAR2(64) := 'AEIOUNAEOUAEIOU';

------------------------------------------------------------------------------
-- Respuesta
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- Contexto del token = :APP_USER y :P2_ID_FACILITADOR de la pagina
------------------------------------------------------------------------------

-- Escribe el 401 y devuelve FALSE si el token no sirve.
FUNCTION contexto(p_token IN VARCHAR2, o_usuario OUT VARCHAR2, o_id_facilitador OUT NUMBER) RETURN BOOLEAN IS
BEGIN
    o_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF o_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN FALSE;
    END IF;
    -- DA "ID_FACILITADOR": SELECT ID_FACILITADOR FROM FACILITADORES WHERE USUARIO = :APP_USER
    BEGIN
        SELECT ID_FACILITADOR INTO o_id_facilitador
          FROM FACILITADORES
         WHERE UPPER(TRIM(USUARIO)) = UPPER(TRIM(o_usuario));
    EXCEPTION
        WHEN NO_DATA_FOUND THEN o_id_facilitador := NULL;
    END;
    RETURN TRUE;
END contexto;

------------------------------------------------------------------------------
-- API publica
------------------------------------------------------------------------------

PROCEDURE inicio(p_token IN VARCHAR2) IS
    l_usuario  VARCHAR2(255);
    l_fac      NUMBER;
    l_default  NUMBER;
    l_ind_ubic FACILITADORES.IND_UBICACION_POSTULACION%TYPE;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;

    -- Default de P2_ID_INSTITUCION (tal cual la pagina, incluido el WHEN OTHERS).
    BEGIN
        SELECT a.ID_INSTITUCION
          INTO l_default
          FROM V_INSTITUCIONES_APP_ETHOS a
         WHERE a.id_facilitador = l_fac
           AND NOT EXISTS (
                 SELECT 1
                   FROM INTERVENCIONES b
                  WHERE b.ID_POSTULACION = a.ID_POSTULACION
                    AND b.fecha_hora >= TRUNC(SYSDATE - 6)
                    AND b.fecha_hora < TRUNC(SYSDATE + 1))
         FETCH FIRST 1 ROWS ONLY;
    EXCEPTION
        WHEN OTHERS THEN l_default := NULL;
    END;

    -- Lo que usa TRG_INTERV_UBICACION: con 'NO' la ubicacion se guarda en 0.
    BEGIN
        SELECT NVL(IND_UBICACION_POSTULACION, 'SI') INTO l_ind_ubic
          FROM FACILITADORES WHERE ID_FACILITADOR = l_fac;
    EXCEPTION
        WHEN OTHERS THEN l_ind_ubic := 'SI';
    END;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);

    -- LOV de P2_ID_INSTITUCION.
    APEX_JSON.OPEN_ARRAY('instituciones');
    IF l_fac IS NOT NULL THEN
        FOR r IN (
            SELECT DISTINCT a.NOMBRE, a.ID_INSTITUCION
              FROM V_INSTITUCIONES_APP_ETHOS a
             WHERE a.id_facilitador = l_fac
               AND NVL(A.ESTADO, 'Activo') = 'Activo'
               AND A.ANIO = FN_ANIO_LECTIVO_ACTUAL()
               AND NVL(A.ESTADO_INSTITUCION, 'I') = 'A'
               AND NOT EXISTS (
                     SELECT 1
                       FROM INTERVENCIONES b
                      WHERE b.ID_POSTULACION = a.id_postulacion
                        AND b.fecha_hora >= TRUNC(SYSDATE - 6)
                        AND b.fecha_hora < TRUNC(SYSDATE + 1))
             ORDER BY a.NOMBRE
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id', r.ID_INSTITUCION);
            APEX_JSON.WRITE('nombre', r.NOMBRE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.WRITE('institucion_por_defecto', l_default, p_write_null => TRUE);

    APEX_JSON.OPEN_ARRAY('motivos');
    FOR i IN 1 .. c_motivos.COUNT LOOP
        APEX_JSON.WRITE(c_motivos(i));
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.WRITE('requiere_ubicacion', NVL(l_ind_ubic, 'SI') <> 'NO');
    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END inicio;

PROCEDURE horarios(p_token IN VARCHAR2, p_id_institucion IN NUMBER) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_ARRAY('data');
    -- LOV de P2_ID_POSTULACION ("Horario").
    FOR r IN (
        SELECT TO_CHAR(a.hora_desde, 'hh24:mi') || '-' || TO_CHAR(a.hora_hasta, 'hh24:mi') horario,
               a.id_postulacion
          FROM V_INSTITUCIONES_APP_ETHOS a
         WHERE a.ID_INSTITUCION = p_id_institucion
           AND a.ID_FACILITADOR = l_fac
           AND NVL(A.ESTADO, 'Activo') = 'Activo'
           AND A.ANIO = FN_ANIO_LECTIVO_ACTUAL()
           AND NOT EXISTS (SELECT * FROM INTERVENCIONES b
                            WHERE TRUNC(b.fecha_hora) = TRUNC(SYSDATE)
                              AND b.ID_POSTULACION = a.id_postulacion)
         ORDER BY TO_CHAR(a.hora_desde, 'hh24:mi') ASC
    ) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id_postulacion', r.id_postulacion);
        APEX_JSON.WRITE('horario', r.horario);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END horarios;

PROCEDURE clase(p_token IN VARCHAR2, p_id_institucion IN NUMBER, p_id_postulacion IN NUMBER) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');

    -- LOV de P2_GRADO
    APEX_JSON.OPEN_ARRAY('grados');
    FOR r IN (SELECT grado FROM V_INSTITUCIONES_APP_ETHOS
               WHERE ID_INSTITUCION = p_id_institucion AND NVL(ESTADO, 'Activo') = 'Activo'
                 AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
                 AND ANIO = FN_ANIO_LECTIVO_ACTUAL()) LOOP
        APEX_JSON.WRITE(r.grado);
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- LOV de P2_SECCION
    APEX_JSON.OPEN_ARRAY('secciones');
    FOR r IN (SELECT seccion FROM V_INSTITUCIONES_APP_ETHOS
               WHERE ID_INSTITUCION = p_id_institucion AND NVL(ESTADO, 'Activo') = 'Activo'
                 AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
                 AND ANIO = FN_ANIO_LECTIVO_ACTUAL()) LOOP
        APEX_JSON.WRITE(r.seccion);
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- LOV de P2_TURNO
    APEX_JSON.OPEN_ARRAY('turnos');
    FOR r IN (SELECT DECODE(turno, 1, UNISTR('Ma\00F1ana'), 2, 'Tarde', 3, 'Noche') descripcion, turno
                FROM V_INSTITUCIONES_APP_ETHOS
               WHERE ID_INSTITUCION = p_id_institucion AND NVL(ESTADO, 'Activo') = 'Activo'
                 AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
                 AND ANIO = FN_ANIO_LECTIVO_ACTUAL()) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('turno', r.turno);
        APEX_JSON.WRITE('descripcion', r.descripcion, p_write_null => TRUE);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- LOV de P2_ID_ENFASIS
    APEX_JSON.OPEN_ARRAY('enfasis');
    FOR r IN (SELECT b.descripcion, a.id_enfasis
                FROM V_INSTITUCIONES_APP_ETHOS a, enfasis b
               WHERE ID_INSTITUCION = p_id_institucion
                 AND ID_FACILITADOR = l_fac
                 AND id_postulacion = p_id_postulacion
                 AND NVL(A.ESTADO, 'Activo') = 'Activo'
                 AND b.id_enfasis(+) = a.id_enfasis
                 AND A.ANIO = FN_ANIO_LECTIVO_ACTUAL()) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id_enfasis', r.id_enfasis, p_write_null => TRUE);
        APEX_JSON.WRITE('descripcion', r.descripcion, p_write_null => TRUE);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- LOV de P2_MANUAL
    APEX_JSON.OPEN_ARRAY('manuales');
    FOR r IN (SELECT MANUAL FROM V_INSTITUCIONES_APP_ETHOS
               WHERE ID_INSTITUCION = p_id_institucion AND ID_FACILITADOR = l_fac
                 AND id_postulacion = p_id_postulacion AND NVL(ESTADO, 'Activo') = 'Activo'
                 AND ANIO = FN_ANIO_LECTIVO_ACTUAL()) LOOP
        APEX_JSON.WRITE(r.MANUAL);
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END clase;

PROCEDURE indices(p_token IN VARCHAR2, p_id_postulacion IN NUMBER, p_manual IN VARCHAR2,
                  p_grado IN VARCHAR2, p_turno IN NUMBER) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
    l_default NUMBER;
    l_propia  NUMBER;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;

    -- La postulacion tiene que ser del facilitador del token: nunca se listan
    -- indices de la postulacion de otro.
    SELECT COUNT(*) INTO l_propia FROM V_INSTITUCIONES_APP_ETHOS
     WHERE id_postulacion = p_id_postulacion AND ID_FACILITADOR = l_fac;

    -- Default de P2_ID_INDICE, tal cual la pagina (primer fila del SELECT).
    IF l_propia > 0 THEN
        BEGIN
            SELECT a.id_indice + 1
              INTO l_default
              FROM INDICES_MANUALES a, INTERVENCIONES b
             WHERE TRANSLATE(UPPER(a.manual), c_con_tildes, c_sin_tildes) = p_manual
               AND b.id_indice = a.id_indice
               AND b.grado = p_grado
               AND b.turno = p_turno
               AND b.id_postulacion = p_id_postulacion
               AND NVL(b.si_no, 'No') = 'Si'
             ORDER BY a.nro_indice ASC
             FETCH FIRST 1 ROWS ONLY;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN l_default := NULL;
        END;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.OPEN_ARRAY('indices');
    IF l_propia > 0 THEN
        -- LOV de P2_ID_INDICE.
        FOR r IN (
            SELECT a.titulo, a.id_indice
              FROM INDICES_MANUALES a
             WHERE TRANSLATE(UPPER(a.manual), c_con_tildes, c_sin_tildes) = p_manual
               AND NOT EXISTS (SELECT 1
                                 FROM INTERVENCIONES b
                                WHERE b.id_indice = a.id_indice
                                  AND b.grado = p_grado
                                  AND b.turno = p_turno
                                  AND b.id_postulacion = p_id_postulacion
                                  AND B.ANIO = FN_ANIO_LECTIVO_ACTUAL()
                                  AND NVL(b.si_no, 'No') = 'Si')
             ORDER BY a.nro_indice ASC
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_indice', r.id_indice);
            APEX_JSON.WRITE('titulo', r.titulo);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.WRITE('indice_por_defecto', l_default, p_write_null => TRUE);
    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END indices;

PROCEDURE resumen(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
    l_total   NUMBER := 0;
    l_si      NUMBER := 0;
    -- FECHA_HORA se guarda en hora de Paraguay (TRG_INTERVENCIONES_SET_FECHA:
    -- SYSDATE - 3/24): el "mes actual" se calcula con el mismo corrimiento.
    l_desde   DATE := TRUNC(SYSDATE - (3/24), 'MM');
    l_inst    NUMBER := 0;
    l_idx     NUMBER := 0;
    l_man     NUMBER := 0;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    IF l_fac IS NOT NULL THEN
        SELECT COUNT(*), COUNT(CASE WHEN NVL(si_no, 'No') = 'Si' THEN 1 END)
          INTO l_total, l_si
          FROM INTERVENCIONES
         WHERE id_facilitador = l_fac
           AND fecha_hora >= l_desde
           AND fecha_hora < ADD_MONTHS(l_desde, 1);

        -- KPI "Instituciones": distintas en sus postulaciones del año lectivo actual.
        SELECT COUNT(DISTINCT p.ID_INSTITUCION) INTO l_inst
          FROM POSTULACIONES p
         WHERE p.ID_FACILITADOR = l_fac
           AND p.ANIO = FN_ANIO_LECTIVO_ACTUAL();

        -- KPI "Materiales desarrollados" (hasta la fecha):
        -- indices desarrollados (sin repetir indice dentro de la misma postulacion)...
        SELECT COUNT(*) INTO l_idx
          FROM (SELECT DISTINCT i.ID_POSTULACION, i.ID_INDICE
                  FROM INTERVENCIONES i
                 WHERE i.ID_FACILITADOR = l_fac
                   AND NVL(i.SI_NO, 'No') = 'Si');

        -- ...y manuales completos: TRG_INTERV_FINALIZA_POST pone la postulacion en
        -- 'Finalizado' cuando se desarrolla el ultimo indice del manual.
        SELECT COUNT(*) INTO l_man
          FROM POSTULACIONES p
         WHERE p.ID_FACILITADOR = l_fac
           AND p.ESTADO = 'Finalizado';
    END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.WRITE('del_mes', l_total);
    APEX_JSON.WRITE('desarrolladas_del_mes', l_si);
    APEX_JSON.WRITE('mes', TO_CHAR(l_desde, 'YYYY-MM'));
    APEX_JSON.WRITE('instituciones', l_inst);
    APEX_JSON.WRITE('indices_desarrollados', l_idx);
    APEX_JSON.WRITE('manuales_desarrollados', l_man);
    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END resumen;

PROCEDURE recientes(p_token IN VARCHAR2, p_limite IN NUMBER DEFAULT 5) IS
    l_usuario VARCHAR2(255);
    l_fac     NUMBER;
    l_limite  NUMBER := LEAST(GREATEST(NVL(p_limite, 5), 1), 50);
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.OPEN_ARRAY('data');
    IF l_fac IS NOT NULL THEN
        FOR r IN (
            SELECT i.ID_INTERVENCION,
                   TO_CHAR(i.FECHA_HORA, 'YYYY-MM-DD"T"HH24:MI:SS') fecha_hora,
                   i.SI_NO, i.MOTIVO_DESARROLLO, i.MANUAL, i.GRADO, i.SECCION,
                   im.TITULO indice,
                   ins.NOMBRE institucion
              FROM INTERVENCIONES i, INDICES_MANUALES im, INSTITUCIONES ins
             WHERE i.ID_FACILITADOR = l_fac
               AND im.ID_INDICE(+) = i.ID_INDICE
               AND ins.ID_INSTITUCION(+) = i.ID_INSTITUCION
             ORDER BY i.FECHA_HORA DESC, i.ID_INTERVENCION DESC
             FETCH FIRST l_limite ROWS ONLY
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_intervencion', r.ID_INTERVENCION);
            APEX_JSON.WRITE('fecha_hora', r.fecha_hora);
            APEX_JSON.WRITE('si_no', r.SI_NO, p_write_null => TRUE);
            APEX_JSON.WRITE('motivo_desarrollo', r.MOTIVO_DESARROLLO, p_write_null => TRUE);
            APEX_JSON.WRITE('manual', r.MANUAL, p_write_null => TRUE);
            APEX_JSON.WRITE('indice', r.indice, p_write_null => TRUE);
            APEX_JSON.WRITE('institucion', r.institucion, p_write_null => TRUE);
            APEX_JSON.WRITE('grado', r.GRADO, p_write_null => TRUE);
            APEX_JSON.WRITE('seccion', r.SECCION, p_write_null => TRUE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END recientes;

PROCEDURE guardar(
    p_token             IN VARCHAR2,
    p_id_institucion    IN NUMBER,
    p_id_postulacion    IN NUMBER,
    p_grado             IN VARCHAR2,
    p_seccion           IN VARCHAR2,
    p_turno             IN NUMBER,
    p_id_enfasis        IN NUMBER,
    p_manual            IN VARCHAR2,
    p_id_indice         IN NUMBER,
    p_si_no             IN VARCHAR2,
    p_motivo_desarrollo IN VARCHAR2,
    p_observacion       IN VARCHAR2,
    p_latitud           IN VARCHAR2,
    p_longitud          IN VARCHAR2)
IS
    l_usuario  VARCHAR2(255);
    l_fac      NUMBER;
    l_n        NUMBER;
    l_obs      VARCHAR2(1000) := TRIM(p_observacion);   -- trim_spaces BOTH
    l_motivo   VARCHAR2(500)  := p_motivo_desarrollo;
    l_ind_ubic FACILITADORES.IND_UBICACION_POSTULACION%TYPE;
    l_lat      VARCHAR2(100)  := p_latitud;
    l_lon      VARCHAR2(100)  := p_longitud;
    l_id       NUMBER;

    FUNCTION falta(p_valor IN VARCHAR2, p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2) RETURN BOOLEAN IS
    BEGIN
        IF p_valor IS NULL THEN
            p_error(400, 'Bad Request', p_etiqueta || ' es obligatorio.', p_campo);
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END falta;

    FUNCTION fuera_de_lista(p_ok IN BOOLEAN, p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2) RETURN BOOLEAN IS
    BEGIN
        IF NOT p_ok THEN
            p_error(400, 'Bad Request', p_etiqueta || ' no es una opcion valida.', p_campo);
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END fuera_de_lista;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    IF l_fac IS NULL THEN
        p_error(403, 'Forbidden', 'Tu usuario no esta registrado como facilitador.');
        RETURN;
    END IF;

    -- Requeridos de la pagina (is_required).
    IF falta(TO_CHAR(p_id_institucion), 'id_institucion', UNISTR('La instituci\00F3n')) THEN RETURN; END IF;
    IF falta(TO_CHAR(p_id_postulacion), 'id_postulacion', 'El horario') THEN RETURN; END IF;
    IF falta(p_grado, 'grado', 'El grado') THEN RETURN; END IF;
    IF falta(TO_CHAR(p_turno), 'turno', 'El turno') THEN RETURN; END IF;
    IF falta(p_manual, 'manual', 'El manual') THEN RETURN; END IF;
    IF falta(TO_CHAR(p_id_indice), 'id_indice', UNISTR('El \00EDndice del manual')) THEN RETURN; END IF;
    IF falta(p_si_no, 'si_no', UNISTR('\00BFDesarrollo?')) THEN RETURN; END IF;

    -- Cada valor tiene que estar en su LOV (como valida APEX las listas):
    -- tambien garantiza que la postulacion es del facilitador del token.
    SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS a
     WHERE a.id_facilitador = l_fac AND a.ID_INSTITUCION = p_id_institucion
       AND NVL(A.ESTADO, 'Activo') = 'Activo' AND A.ANIO = FN_ANIO_LECTIVO_ACTUAL()
       AND NVL(A.ESTADO_INSTITUCION, 'I') = 'A'
       AND NOT EXISTS (SELECT 1 FROM INTERVENCIONES b
                        WHERE b.ID_POSTULACION = a.id_postulacion
                          AND b.fecha_hora >= TRUNC(SYSDATE - 6)
                          AND b.fecha_hora < TRUNC(SYSDATE + 1));
    IF fuera_de_lista(l_n > 0, 'id_institucion', UNISTR('La instituci\00F3n')) THEN RETURN; END IF;

    SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS a
     WHERE a.ID_INSTITUCION = p_id_institucion AND a.ID_FACILITADOR = l_fac
       AND a.id_postulacion = p_id_postulacion
       AND NVL(A.ESTADO, 'Activo') = 'Activo' AND A.ANIO = FN_ANIO_LECTIVO_ACTUAL()
       AND NOT EXISTS (SELECT * FROM INTERVENCIONES b
                        WHERE TRUNC(b.fecha_hora) = TRUNC(SYSDATE)
                          AND b.ID_POSTULACION = a.id_postulacion);
    IF fuera_de_lista(l_n > 0, 'id_postulacion', 'El horario') THEN RETURN; END IF;

    SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS
     WHERE ID_INSTITUCION = p_id_institucion AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
       AND NVL(ESTADO, 'Activo') = 'Activo' AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
       AND grado = p_grado;
    IF fuera_de_lista(l_n > 0, 'grado', 'El grado') THEN RETURN; END IF;

    IF p_seccion IS NOT NULL THEN
        SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS
         WHERE ID_INSTITUCION = p_id_institucion AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
           AND NVL(ESTADO, 'Activo') = 'Activo' AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
           AND seccion = p_seccion;
        IF fuera_de_lista(l_n > 0, 'seccion', UNISTR('La secci\00F3n')) THEN RETURN; END IF;
    END IF;

    SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS
     WHERE ID_INSTITUCION = p_id_institucion AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
       AND NVL(ESTADO, 'Activo') = 'Activo' AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
       AND turno = p_turno;
    IF fuera_de_lista(l_n > 0, 'turno', 'El turno') THEN RETURN; END IF;

    IF p_id_enfasis IS NOT NULL THEN
        SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS
         WHERE ID_INSTITUCION = p_id_institucion AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
           AND NVL(ESTADO, 'Activo') = 'Activo' AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
           AND id_enfasis = p_id_enfasis;
        IF fuera_de_lista(l_n > 0, 'id_enfasis', UNISTR('El \00E9nfasis')) THEN RETURN; END IF;
    END IF;

    SELECT COUNT(*) INTO l_n FROM V_INSTITUCIONES_APP_ETHOS
     WHERE ID_INSTITUCION = p_id_institucion AND ID_FACILITADOR = l_fac AND id_postulacion = p_id_postulacion
       AND NVL(ESTADO, 'Activo') = 'Activo' AND ANIO = FN_ANIO_LECTIVO_ACTUAL()
       AND MANUAL = p_manual;
    IF fuera_de_lista(l_n > 0, 'manual', 'El manual') THEN RETURN; END IF;

    SELECT COUNT(*) INTO l_n FROM INDICES_MANUALES a
     WHERE a.id_indice = p_id_indice
       AND TRANSLATE(UPPER(a.manual), c_con_tildes, c_sin_tildes) = p_manual
       AND NOT EXISTS (SELECT 1 FROM INTERVENCIONES b
                        WHERE b.id_indice = a.id_indice AND b.grado = p_grado AND b.turno = p_turno
                          AND b.id_postulacion = p_id_postulacion
                          AND B.ANIO = FN_ANIO_LECTIVO_ACTUAL()
                          AND NVL(b.si_no, 'No') = 'Si');
    IF fuera_de_lista(l_n > 0, 'id_indice', UNISTR('El \00EDndice del manual')) THEN RETURN; END IF;

    IF p_si_no NOT IN ('Si', 'No') THEN
        p_error(400, 'Bad Request', UNISTR('\00BFDesarrollo? debe ser Si o No.'), 'si_no');
        RETURN;
    END IF;

    IF p_si_no = 'Si' THEN
        l_motivo := NULL;   -- TRG_INTERV_SINO_MOTIVO lo limpia igual
    ELSE
        -- TRG_INTERV_SINO_MOTIVO
        IF l_motivo IS NULL THEN
            p_error(400, 'Bad Request', 'Debe ingresar motivo de desarrollo cuando la respuesta es NO', 'motivo_desarrollo');
            RETURN;
        END IF;
        l_n := 0;
        FOR i IN 1 .. c_motivos.COUNT LOOP
            IF c_motivos(i) = l_motivo THEN l_n := 1; END IF;
        END LOOP;
        IF fuera_de_lista(l_n > 0, 'motivo_desarrollo', 'El motivo') THEN RETURN; END IF;
    END IF;

    -- Validacion "OBS" de la pagina.
    IF NVL(p_si_no, 'No') = 'No' AND l_motivo = 'Otros' AND l_obs IS NULL THEN
        p_error(400, 'Bad Request', UNISTR('Debe cargar una observaci\00F3n para guardar'), 'observacion');
        RETURN;
    END IF;

    -- Ubicacion: LATITUD/LONGITUD son NOT NULL. Con IND_UBICACION_POSTULACION = 'NO'
    -- TRG_INTERV_UBICACION las pone en 0; si no, hacen falta las del dispositivo.
    BEGIN
        SELECT NVL(IND_UBICACION_POSTULACION, 'SI') INTO l_ind_ubic
          FROM FACILITADORES WHERE ID_FACILITADOR = l_fac;
    EXCEPTION
        WHEN OTHERS THEN l_ind_ubic := 'SI';
    END;
    IF NVL(l_ind_ubic, 'SI') = 'NO' THEN
        l_lat := NVL(l_lat, '0');
        l_lon := NVL(l_lon, '0');
    ELSIF l_lat IS NULL OR l_lon IS NULL THEN
        p_error(400, 'Bad Request', UNISTR('No se pudo obtener tu ubicaci\00F3n. Activ\00E1 el GPS y permit\00ED el acceso a la ubicaci\00F3n.'), 'ubicacion');
        RETURN;
    END IF;

    -- "Procesar pantalla Crear Registro": INSERT de la region (los triggers ponen
    -- ID, FECHA_HORA, ANIO, ID_AUDITORIA y finalizan la postulacion si corresponde).
    INSERT INTO INTERVENCIONES (
        ID_FACILITADOR, USUARIO, ID_INSTITUCION, ID_POSTULACION, GRADO, SECCION, TURNO,
        ID_ENFASIS, MANUAL, ID_INDICE, SI_NO, MOTIVO_DESARROLLO, OBSERVACION, LATITUD, LONGITUD)
    VALUES (
        l_fac, l_usuario, p_id_institucion, p_id_postulacion, p_grado, p_seccion, p_turno,
        p_id_enfasis, p_manual, p_id_indice, p_si_no, l_motivo, l_obs, l_lat, l_lon)
    RETURNING ID_INTERVENCION INTO l_id;
    COMMIT;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', UNISTR('Intervenci\00F3n registrada'));
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.WRITE('id_intervencion', l_id);
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
END guardar;

END PKG_INTERVENCIONES_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_INTERVENCIONES_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_INTERVENCIONES_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_INTERVENCIONES_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_INTERVENCIONES_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  TYPE t_rutas IS TABLE OF VARCHAR2(100);
  l_rutas t_rutas := t_rutas(
      'mis-intervenciones', 'mis-intervenciones/inicio', 'mis-intervenciones/horarios',
      'mis-intervenciones/clase', 'mis-intervenciones/indices', 'mis-intervenciones/resumen',
      'mis-intervenciones/recientes');
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
       AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_INTERVENCIONES_APP_ETHOS') = 0;
    IF l_ajenos > 0 THEN
      RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/' || l_rutas(i) ||
        ' ya existe y no es de este script: no se publico nada para no pisarla.');
    END IF;
  END LOOP;

  publicar('mis-intervenciones/inicio', 'GET',
           'PKG_INTERVENCIONES_APP_ETHOS.INICIO(p_token => l_token);');
  publicar('mis-intervenciones/horarios', 'GET',
           'PKG_INTERVENCIONES_APP_ETHOS.HORARIOS(p_token => l_token, p_id_institucion => TO_NUMBER(:id_institucion));');
  publicar('mis-intervenciones/clase', 'GET',
           'PKG_INTERVENCIONES_APP_ETHOS.CLASE(p_token => l_token, p_id_institucion => TO_NUMBER(:id_institucion), p_id_postulacion => TO_NUMBER(:id_postulacion));');
  publicar('mis-intervenciones/indices', 'GET',
           'PKG_INTERVENCIONES_APP_ETHOS.INDICES(p_token => l_token, p_id_postulacion => TO_NUMBER(:id_postulacion), p_manual => :manual, p_grado => :grado, p_turno => TO_NUMBER(:turno));');
  publicar('mis-intervenciones/resumen', 'GET',
           'PKG_INTERVENCIONES_APP_ETHOS.RESUMEN(p_token => l_token);');
  publicar('mis-intervenciones/recientes', 'GET',
           'PKG_INTERVENCIONES_APP_ETHOS.RECIENTES(p_token => l_token, p_limite => TO_NUMBER(:limite));');
  publicar('mis-intervenciones', 'POST',
           'PKG_INTERVENCIONES_APP_ETHOS.GUARDAR(p_token => l_token, p_id_institucion => TO_NUMBER(:id_institucion), p_id_postulacion => TO_NUMBER(:id_postulacion), p_grado => :grado, p_seccion => :seccion, p_turno => TO_NUMBER(:turno), p_id_enfasis => TO_NUMBER(:id_enfasis), p_manual => :manual, p_id_indice => TO_NUMBER(:id_indice), p_si_no => :si_no, p_motivo_desarrollo => :motivo_desarrollo, p_observacion => :observacion, p_latitud => :latitud, p_longitud => :longitud);');
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 7 endpoints de ethos/mis-intervenciones.');
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
     AND t.URI_TEMPLATE LIKE 'mis-intervenciones%'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_INTERVENCIONES_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de mis-intervenciones publicados: ' || l_n || ' de 7.');
END;
/

-- La copia tiene que traer lo mismo que V_INSTITUCIONES en una sesion en espanol (APEX).
DECLARE
  l_original NUMBER;
  l_app      NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_original FROM V_INSTITUCIONES;
  SELECT COUNT(*) INTO l_app      FROM V_INSTITUCIONES_APP_ETHOS;
  DBMS_OUTPUT.PUT_LINE('[INFO] Clases de hoy: V_INSTITUCIONES = ' || l_original
    || ' / V_INSTITUCIONES_APP_ETHOS = ' || l_app
    || CASE WHEN l_original = l_app THEN '  (iguales)' ELSE '  (DIFERENTES: avisar antes de usar la app)' END);
END;
/
