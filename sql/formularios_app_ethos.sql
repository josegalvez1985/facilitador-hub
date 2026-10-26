--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Formularios": Form. 1, 2 y 3 del facilitador
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_FORMULARIOS_APP_ETHOS
--   2. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET mis-formularios/postulaciones?anio=                  Form. 1, 2 y 3
--        GET mis-formularios/institucion?id_institucion=&anio=    Form. 1 y 2 (cabecera)
--        GET mis-formularios/intervenciones?id_institucion=&desde=&hasta=   Form. 2
--        GET mis-formularios/bloqueos?anio=                       Form. 3 (lo rojo)
--      No pisa nada: si alguna ruta ya existe y NO es de este paquete, se detiene.
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- DE DONDE SALE
--   Son las consultas que usa el sitio editorial-ethos-app para los mismos
--   formularios (postulaciones.sql: formulario y listar_todas;
--   intervenciones_crud.sql: listar; facilitadores_dias_bloqueos.sql; etapas),
--   con UNA diferencia: aca el ID_FACILITADOR sale del TOKEN, nunca del
--   cliente. Un facilitador solo ve sus postulaciones, sus intervenciones y su
--   bloqueo; el Form. 1 de una institucion trae solo SUS clases en ella, y solo
--   si tiene alguna ahi ese año.
--   "Activa" = NVL(ESTADO,'Activo') <> 'Inactivo' (criterio de la pagina 60).
--
-- SOLO LECTURA: ningun endpoint escribe en la base ni toca objetos de APEX.
-- FACILITADORES_DIAS_BLOQUEOS (tabla del sitio, no de APEX) se lee con SQL
-- dinamico: si no existe, el paquete compila igual y el Form. 3 sale sin rojo.
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_FORMULARIOS_APP_ETHOS AS

  -- { success, es_facilitador, anio, anio_actual, anios: [..], facilitador: { nombre, telefono },
  --   etapas: [ { fecha_inicio, fecha_fin } ],
  --   data: [ { id, id_institucion, institucion, turno, seccion, g2 … g3m, ser … liderazgo,
  --     lunes_desde … viernes_hasta, enfasis, estado } ] }   (solo las activas)
  PROCEDURE postulaciones(p_token IN VARCHAR2, p_anio IN VARCHAR2);

  -- { success, anio, nombre, direccion, departamento, ciudad, barrio,
  --   autoridades: [ { cargo, nombre, ci, telefono } ],
  --   detalle: [ { nro_item, id, turno, seccion, g2 … g3m, enfasis, ser … liderazgo,
  --     lunes_desde … viernes_hasta, materia, docente, telefono } ],
  --   horarios: [ { turno, hora_inicio, hora_fin, total, observacion } ] }
  -- 404 si el facilitador no tiene postulaciones en esa institucion ese año.
  PROCEDURE institucion(p_token IN VARCHAR2, p_id_institucion IN VARCHAR2, p_anio IN VARCHAR2);

  -- { success, data: [ { id_intervencion, id_postulacion, fecha (DD/MM/YYYY), nro_indice,
  --   si_no, motivo_desarrollo } ] }   desde y hasta: 'YYYY-MM-DD', inclusive.
  PROCEDURE intervenciones(
      p_token          IN VARCHAR2,
      p_id_institucion IN VARCHAR2,
      p_desde          IN VARCHAR2,
      p_hasta          IN VARCHAR2);

  -- { success, data: { lunes, martes, miercoles, jueves, viernes } | null }
  -- Cada dia: las franjas bloqueadas, "07:00 - 11:40, 13:00 - 17:05".
  PROCEDURE bloqueos(p_token IN VARCHAR2, p_anio IN VARCHAR2);

END PKG_FORMULARIOS_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_FORMULARIOS_APP_ETHOS AS

-- Constantes antes que cualquier procedimiento del body.
c_max_dias CONSTANT PLS_INTEGER := 400;

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

-- Entero positivo, o NULL.
FUNCTION f_numero(p_valor IN VARCHAR2) RETURN NUMBER IS
    l_n NUMBER;
BEGIN
    l_n := TO_NUMBER(TRIM(p_valor));
    RETURN CASE WHEN l_n > 0 AND l_n = TRUNC(l_n) THEN l_n END;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END f_numero;

FUNCTION f_anio RETURN VARCHAR2 IS
BEGIN
    RETURN TO_CHAR(FN_ANIO_LECTIVO_ACTUAL());
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END f_anio;

-- 'YYYY-MM-DD' -> DATE, o NULL. No depende del idioma de la sesion.
FUNCTION f_fecha(p_valor IN VARCHAR2) RETURN DATE IS
BEGIN
    RETURN TO_DATE(TRIM(p_valor), 'YYYY-MM-DD');
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END f_fecha;

-- Valida el token y devuelve el ID_FACILITADOR del usuario (NULL si no es facilitador).
-- FALSE (con el 401 ya escrito) si el token no sirve.
FUNCTION identificar(p_token IN VARCHAR2, p_fac OUT NUMBER) RETURN BOOLEAN IS
    l_usuario VARCHAR2(255);
BEGIN
    l_usuario := PKG_AUTH_ETHOS.validar_token(p_token);
    IF l_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN FALSE;
    END IF;
    BEGIN
        SELECT ID_FACILITADOR INTO p_fac FROM FACILITADORES
         WHERE UPPER(TRIM(USUARIO)) = UPPER(TRIM(l_usuario));
    EXCEPTION
        WHEN OTHERS THEN p_fac := NULL;
    END;
    RETURN TRUE;
END identificar;

PROCEDURE postulaciones(p_token IN VARCHAR2, p_anio IN VARCHAR2) IS
    l_fac  NUMBER;
    l_anio VARCHAR2(16) := NVL(TRIM(p_anio), f_anio);
BEGIN
    IF NOT identificar(p_token, l_fac) THEN RETURN; END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.WRITE('anio', l_anio);
    APEX_JSON.WRITE('anio_actual', f_anio);

    APEX_JSON.OPEN_OBJECT('facilitador');
    FOR f IN (SELECT NOMBRE_APELLIDO, TELEFONO FROM FACILITADORES WHERE ID_FACILITADOR = l_fac) LOOP
        APEX_JSON.WRITE('nombre', f.NOMBRE_APELLIDO, p_write_null => TRUE);
        APEX_JSON.WRITE('telefono', f.TELEFONO, p_write_null => TRUE);
    END LOOP;
    APEX_JSON.CLOSE_OBJECT;

    -- Los años en que el facilitador tiene postulaciones.
    APEX_JSON.OPEN_ARRAY('anios');
    FOR a IN (SELECT DISTINCT TO_CHAR(ANIO) AS anio FROM POSTULACIONES
               WHERE ID_FACILITADOR = l_fac AND ANIO IS NOT NULL
               ORDER BY 1 DESC) LOOP
        APEX_JSON.WRITE(a.anio);
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- Las etapas (ETAPAS: ID_ETAPA, FECHA_INICIO, FECHA_FIN), para elegir el periodo del Form. 2.
    APEX_JSON.OPEN_ARRAY('etapas');
    FOR e IN (SELECT TO_CHAR(FECHA_INICIO, 'YYYY-MM-DD') AS inicio,
                     TO_CHAR(FECHA_FIN, 'YYYY-MM-DD') AS fin
                FROM ETAPAS
               ORDER BY FECHA_INICIO, FECHA_FIN, ID_ETAPA) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('fecha_inicio', e.inicio);
        APEX_JSON.WRITE('fecha_fin', e.fin);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- El SELECT de listar_todas (postulaciones.sql), solo las activas del facilitador del token.
    APEX_JSON.OPEN_ARRAY('data');
    FOR r IN (
        SELECT p.id_postulacion, p.id_institucion, i.nombre AS institucion, p.turno, p.seccion,
               p."2" AS g2, p."3" AS g3, p."4" AS g4, p."5" AS g5, p."6" AS g6,
               p."7" AS g7, p."8" AS g8, p."9" AS g9,
               p."1M" AS g1m, p."2M" AS g2m, p."3M" AS g3m,
               p.ser, p.hacer, p.tener, p.caracter, p.vision, p.coraje, p.liderazgo,
               TO_CHAR(p.lunes_desde, 'HH24:MI')     AS lunes_desde,
               TO_CHAR(p.lunes_hasta, 'HH24:MI')     AS lunes_hasta,
               TO_CHAR(p.martes_desde, 'HH24:MI')    AS martes_desde,
               TO_CHAR(p.martes_hasta, 'HH24:MI')    AS martes_hasta,
               TO_CHAR(p.miercoles_desde, 'HH24:MI') AS miercoles_desde,
               TO_CHAR(p.miercoles_hasta, 'HH24:MI') AS miercoles_hasta,
               TO_CHAR(p.jueves_desde, 'HH24:MI')    AS jueves_desde,
               TO_CHAR(p.jueves_hasta, 'HH24:MI')    AS jueves_hasta,
               TO_CHAR(p.viernes_desde, 'HH24:MI')   AS viernes_desde,
               TO_CHAR(p.viernes_hasta, 'HH24:MI')   AS viernes_hasta,
               e.descripcion AS enfasis, p.estado
          FROM postulaciones p
          JOIN instituciones i ON i.id_institucion = p.id_institucion
          LEFT JOIN enfasis e  ON e.id_enfasis = p.id_enfasis
         WHERE p.id_facilitador = l_fac
           AND p.anio = l_anio
           AND NVL(p.estado, 'Activo') <> 'Inactivo'
         ORDER BY UPPER(i.nombre), p.turno,
                  NVL(TO_CHAR(p.lunes_desde, 'HH24:MI'), '99'),
                  NVL(TO_CHAR(p.martes_desde, 'HH24:MI'), '99'),
                  NVL(TO_CHAR(p.miercoles_desde, 'HH24:MI'), '99'),
                  NVL(TO_CHAR(p.jueves_desde, 'HH24:MI'), '99'),
                  NVL(TO_CHAR(p.viernes_desde, 'HH24:MI'), '99'),
                  p.id_postulacion
    ) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id',             r.id_postulacion);
        APEX_JSON.WRITE('id_institucion', r.id_institucion);
        APEX_JSON.WRITE('institucion',    r.institucion);
        APEX_JSON.WRITE('turno',          r.turno);
        APEX_JSON.WRITE('seccion',        r.seccion);
        APEX_JSON.WRITE('g2',  r.g2);  APEX_JSON.WRITE('g3',  r.g3);  APEX_JSON.WRITE('g4',  r.g4);
        APEX_JSON.WRITE('g5',  r.g5);  APEX_JSON.WRITE('g6',  r.g6);  APEX_JSON.WRITE('g7',  r.g7);
        APEX_JSON.WRITE('g8',  r.g8);  APEX_JSON.WRITE('g9',  r.g9);
        APEX_JSON.WRITE('g1m', r.g1m); APEX_JSON.WRITE('g2m', r.g2m); APEX_JSON.WRITE('g3m', r.g3m);
        APEX_JSON.WRITE('ser',       r.ser);       APEX_JSON.WRITE('hacer',     r.hacer);
        APEX_JSON.WRITE('tener',     r.tener);     APEX_JSON.WRITE('caracter',  r.caracter);
        APEX_JSON.WRITE('vision',    r.vision);    APEX_JSON.WRITE('coraje',    r.coraje);
        APEX_JSON.WRITE('liderazgo', r.liderazgo);
        APEX_JSON.WRITE('lunes_desde',     r.lunes_desde);
        APEX_JSON.WRITE('lunes_hasta',     r.lunes_hasta);
        APEX_JSON.WRITE('martes_desde',    r.martes_desde);
        APEX_JSON.WRITE('martes_hasta',    r.martes_hasta);
        APEX_JSON.WRITE('miercoles_desde', r.miercoles_desde);
        APEX_JSON.WRITE('miercoles_hasta', r.miercoles_hasta);
        APEX_JSON.WRITE('jueves_desde',    r.jueves_desde);
        APEX_JSON.WRITE('jueves_hasta',    r.jueves_hasta);
        APEX_JSON.WRITE('viernes_desde',   r.viernes_desde);
        APEX_JSON.WRITE('viernes_hasta',   r.viernes_hasta);
        APEX_JSON.WRITE('enfasis',         r.enfasis);
        APEX_JSON.WRITE('estado',          r.estado);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END postulaciones;

PROCEDURE institucion(p_token IN VARCHAR2, p_id_institucion IN VARCHAR2, p_anio IN VARCHAR2) IS
    l_fac  NUMBER;
    l_inst NUMBER := f_numero(p_id_institucion);
    l_anio VARCHAR2(16) := NVL(TRIM(p_anio), f_anio);
    l_n    PLS_INTEGER;
BEGIN
    IF NOT identificar(p_token, l_fac) THEN RETURN; END IF;
    IF l_inst IS NULL THEN
        p_error(400, 'Bad Request', 'La institucion es obligatoria'); RETURN;
    END IF;
    -- Solo una institucion donde el facilitador del token tiene postulaciones ese año.
    SELECT COUNT(*) INTO l_n FROM postulaciones
     WHERE id_institucion = l_inst AND id_facilitador = l_fac AND anio = l_anio;
    IF l_n = 0 THEN
        p_error(404, 'Not Found', 'No tenes clases en esa institucion en ' || l_anio); RETURN;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('anio', l_anio);

    -- Como postulaciones.sql (formulario): sin el `id_pais = 1` de DATOS.
    FOR ins IN (SELECT i.nombre, i.direccion, dp.nombre AS departamento,
                       c.nombre AS ciudad, b.nombre AS barrio
                  FROM instituciones i
                  LEFT JOIN departamentos dp ON dp.id_pais = i.id_pais
                                            AND dp.id_departamento = i.id_departamento
                  LEFT JOIN ciudades c       ON c.id_ciudad = i.id_ciudad
                  LEFT JOIN barrios b        ON b.id_barrio = i.id_barrio
                 WHERE i.id_institucion = l_inst) LOOP
        APEX_JSON.WRITE('nombre',       ins.nombre);
        APEX_JSON.WRITE('direccion',    ins.direccion);
        APEX_JSON.WRITE('departamento', ins.departamento);
        APEX_JSON.WRITE('ciudad',       ins.ciudad);
        APEX_JSON.WRITE('barrio',       ins.barrio);
    END LOOP;

    -- Las del periodo: directores y coordinadores activos con PERIODO = anio.
    APEX_JSON.OPEN_ARRAY('autoridades');
    FOR r IN (SELECT idr.cargo, TRIM(d.nombre_apellido) AS nombre, d.nro_ci,
                     NVL(TRIM(idr.nro_telefono), TRIM(d.nro_telefono)) AS telefono
                FROM instituciones_directores idr
                JOIN directores d ON d.id_director = idr.id_director
               WHERE idr.periodo = l_anio
                 AND UPPER(TRIM(idr.estado)) = 'A'
                 AND idr.id_institucion = l_inst
              UNION ALL
              SELECT ic.tipo_coordinador, TRIM(c.nombre_apellido), c.nro_ci,
                     NVL(TRIM(ic.nro_telefono), TRIM(c.nro_telefono))
                FROM instituciones_coordnadores ic
                JOIN coordinadores c ON c.id_coordinador = ic.id_coordinador
               WHERE ic.periodo = l_anio
                 AND UPPER(TRIM(ic.estado)) = 'A'
                 AND ic.id_institucion = l_inst) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('cargo',    r.cargo);
        APEX_JSON.WRITE('nombre',   r.nombre);
        APEX_JSON.WRITE('ci',       r.nro_ci);
        APEX_JSON.WRITE('telefono', r.telefono);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    -- Las activas DEL FACILITADOR, numeradas por turno en orden de dia y hora, como DATOS.
    APEX_JSON.OPEN_ARRAY('detalle');
    FOR r IN (
        SELECT ROW_NUMBER() OVER (
                 PARTITION BY p.turno
                 ORDER BY NVL(TO_CHAR(p.lunes_desde, 'HH24:MI'), '99'),
                          NVL(TO_CHAR(p.martes_desde, 'HH24:MI'), '99'),
                          NVL(TO_CHAR(p.miercoles_desde, 'HH24:MI'), '99'),
                          NVL(TO_CHAR(p.jueves_desde, 'HH24:MI'), '99'),
                          NVL(TO_CHAR(p.viernes_desde, 'HH24:MI'), '99'),
                          p.id_postulacion) AS nro_item,
               p.id_postulacion, p.turno, p.seccion,
               p."2" AS g2, p."3" AS g3, p."4" AS g4, p."5" AS g5, p."6" AS g6,
               p."7" AS g7, p."8" AS g8, p."9" AS g9,
               p."1M" AS g1m, p."2M" AS g2m, p."3M" AS g3m,
               e.descripcion AS enfasis,
               p.ser, p.hacer, p.tener, p.caracter, p.vision, p.coraje, p.liderazgo,
               TO_CHAR(p.lunes_desde, 'HH24:MI')     AS lunes_desde,
               TO_CHAR(p.lunes_hasta, 'HH24:MI')     AS lunes_hasta,
               TO_CHAR(p.martes_desde, 'HH24:MI')    AS martes_desde,
               TO_CHAR(p.martes_hasta, 'HH24:MI')    AS martes_hasta,
               TO_CHAR(p.miercoles_desde, 'HH24:MI') AS miercoles_desde,
               TO_CHAR(p.miercoles_hasta, 'HH24:MI') AS miercoles_hasta,
               TO_CHAR(p.jueves_desde, 'HH24:MI')    AS jueves_desde,
               TO_CHAR(p.jueves_hasta, 'HH24:MI')    AS jueves_hasta,
               TO_CHAR(p.viernes_desde, 'HH24:MI')   AS viernes_desde,
               TO_CHAR(p.viernes_hasta, 'HH24:MI')   AS viernes_hasta,
               m.descripcion AS materia,
               COALESCE(d.nombre_apellido, p.nombre_profesor) AS docente,
               COALESCE(TRIM(p.telefono), TRIM(d.nro_telefono)) AS telefono
          FROM postulaciones p
          LEFT JOIN enfasis e  ON e.id_enfasis = p.id_enfasis
          LEFT JOIN materias m ON m.id_materia = p.id_materia
          LEFT JOIN docentes d ON d.id_docente = p.id_docente
         WHERE p.id_institucion = l_inst
           AND p.id_facilitador = l_fac
           AND p.anio = l_anio
           AND NVL(p.estado, 'Activo') <> 'Inactivo'
         ORDER BY p.turno, nro_item
    ) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('nro_item', r.nro_item);
        APEX_JSON.WRITE('id',       r.id_postulacion);
        APEX_JSON.WRITE('turno',    r.turno);
        APEX_JSON.WRITE('seccion',  r.seccion);
        APEX_JSON.WRITE('g2',  r.g2);  APEX_JSON.WRITE('g3',  r.g3);  APEX_JSON.WRITE('g4',  r.g4);
        APEX_JSON.WRITE('g5',  r.g5);  APEX_JSON.WRITE('g6',  r.g6);  APEX_JSON.WRITE('g7',  r.g7);
        APEX_JSON.WRITE('g8',  r.g8);  APEX_JSON.WRITE('g9',  r.g9);
        APEX_JSON.WRITE('g1m', r.g1m); APEX_JSON.WRITE('g2m', r.g2m); APEX_JSON.WRITE('g3m', r.g3m);
        APEX_JSON.WRITE('enfasis',   r.enfasis);
        APEX_JSON.WRITE('ser',       r.ser);       APEX_JSON.WRITE('hacer',     r.hacer);
        APEX_JSON.WRITE('tener',     r.tener);     APEX_JSON.WRITE('caracter',  r.caracter);
        APEX_JSON.WRITE('vision',    r.vision);    APEX_JSON.WRITE('coraje',    r.coraje);
        APEX_JSON.WRITE('liderazgo', r.liderazgo);
        APEX_JSON.WRITE('lunes_desde',     r.lunes_desde);
        APEX_JSON.WRITE('lunes_hasta',     r.lunes_hasta);
        APEX_JSON.WRITE('martes_desde',    r.martes_desde);
        APEX_JSON.WRITE('martes_hasta',    r.martes_hasta);
        APEX_JSON.WRITE('miercoles_desde', r.miercoles_desde);
        APEX_JSON.WRITE('miercoles_hasta', r.miercoles_hasta);
        APEX_JSON.WRITE('jueves_desde',    r.jueves_desde);
        APEX_JSON.WRITE('jueves_hasta',    r.jueves_hasta);
        APEX_JSON.WRITE('viernes_desde',   r.viernes_desde);
        APEX_JSON.WRITE('viernes_hasta',   r.viernes_hasta);
        APEX_JSON.WRITE('materia',         r.materia);
        APEX_JSON.WRITE('docente',         r.docente);
        APEX_JSON.WRITE('telefono',        r.telefono);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.OPEN_ARRAY('horarios');
    FOR r IN (SELECT turno, observacion,
                     TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
                     TO_CHAR(hora_fin, 'HH24:MI')    AS hora_fin, total
                FROM horario_instituciones
               WHERE id_institucion = l_inst AND anio = l_anio
               ORDER BY turno, TO_CHAR(hora_inicio, 'HH24:MI')) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('turno',       r.turno);
        APEX_JSON.WRITE('hora_inicio', r.hora_inicio);
        APEX_JSON.WRITE('hora_fin',    r.hora_fin);
        APEX_JSON.WRITE('total',       r.total);
        APEX_JSON.WRITE('observacion', r.observacion);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;

    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END institucion;

PROCEDURE intervenciones(
    p_token          IN VARCHAR2,
    p_id_institucion IN VARCHAR2,
    p_desde          IN VARCHAR2,
    p_hasta          IN VARCHAR2)
IS
    l_fac   NUMBER;
    l_inst  NUMBER := f_numero(p_id_institucion);
    l_desde DATE := f_fecha(p_desde);
    l_hasta DATE := f_fecha(p_hasta);
BEGIN
    IF NOT identificar(p_token, l_fac) THEN RETURN; END IF;
    IF l_inst IS NULL OR l_desde IS NULL OR l_hasta IS NULL THEN
        p_error(400, 'Bad Request', 'Faltan la institucion o las fechas (YYYY-MM-DD)'); RETURN;
    END IF;
    IF l_hasta < l_desde OR l_hasta - l_desde > c_max_dias THEN
        p_error(400, 'Bad Request', 'El periodo no es valido'); RETURN;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_ARRAY('data');
    -- Las columnas que el Form. 2 lee de intervenciones-crud, solo del facilitador del token.
    FOR r IN (
        SELECT i.id_intervencion, i.id_postulacion,
               TO_CHAR(i.fecha_hora, 'DD/MM/YYYY') AS fecha,
               im.nro_indice, i.si_no, i.motivo_desarrollo
          FROM intervenciones i
          LEFT JOIN indices_manuales im ON im.id_indice = i.id_indice
         WHERE i.id_facilitador = l_fac
           AND i.id_institucion = l_inst
           AND i.fecha_hora >= l_desde
           AND i.fecha_hora < l_hasta + 1
         ORDER BY i.fecha_hora, i.id_intervencion
    ) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id_intervencion',   r.id_intervencion);
        APEX_JSON.WRITE('id_postulacion',    r.id_postulacion);
        APEX_JSON.WRITE('fecha',             r.fecha);
        APEX_JSON.WRITE('nro_indice',        r.nro_indice);
        APEX_JSON.WRITE('si_no',             r.si_no);
        APEX_JSON.WRITE('motivo_desarrollo', r.motivo_desarrollo);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END intervenciones;

PROCEDURE bloqueos(p_token IN VARCHAR2, p_anio IN VARCHAR2) IS
    l_fac  NUMBER;
    l_anio VARCHAR2(16) := NVL(TRIM(p_anio), f_anio);
    l_cur  SYS_REFCURSOR;
    l_lu   VARCHAR2(400);
    l_ma   VARCHAR2(400);
    l_mi   VARCHAR2(400);
    l_ju   VARCHAR2(400);
    l_vi   VARCHAR2(400);
    l_hay  BOOLEAN := FALSE;
BEGIN
    IF NOT identificar(p_token, l_fac) THEN RETURN; END IF;

    IF l_fac IS NOT NULL THEN
        BEGIN
            -- SQL dinamico: ver el encabezado del script.
            OPEN l_cur FOR
                'SELECT b.lunes, b.martes, b.miercoles, b.jueves, b.viernes
                   FROM facilitadores_dias_bloqueos b
                   JOIN anios_lectivos a ON a.id_anio = b.id_anio
                  WHERE b.id_facilitador = :f AND TO_CHAR(a.anio) = :a
                  ORDER BY b.id_bloqueo'
                USING l_fac, l_anio;
            FETCH l_cur INTO l_lu, l_ma, l_mi, l_ju, l_vi;
            l_hay := l_cur%FOUND;
            CLOSE l_cur;
        EXCEPTION
            WHEN OTHERS THEN
                IF l_cur%ISOPEN THEN CLOSE l_cur; END IF;
                l_hay := FALSE;
        END;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    IF l_hay THEN
        APEX_JSON.OPEN_OBJECT('data');
        APEX_JSON.WRITE('lunes',     l_lu, p_write_null => TRUE);
        APEX_JSON.WRITE('martes',    l_ma, p_write_null => TRUE);
        APEX_JSON.WRITE('miercoles', l_mi, p_write_null => TRUE);
        APEX_JSON.WRITE('jueves',    l_ju, p_write_null => TRUE);
        APEX_JSON.WRITE('viernes',   l_vi, p_write_null => TRUE);
        APEX_JSON.CLOSE_OBJECT;
    ELSE
        APEX_JSON.WRITE('data', CAST(NULL AS VARCHAR2), p_write_null => TRUE);
    END IF;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END bloqueos;

END PKG_FORMULARIOS_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_FORMULARIOS_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_FORMULARIOS_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_FORMULARIOS_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_FORMULARIOS_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  TYPE t_rutas IS TABLE OF VARCHAR2(100);
  l_rutas t_rutas := t_rutas(
      'mis-formularios/postulaciones',
      'mis-formularios/institucion',
      'mis-formularios/intervenciones',
      'mis-formularios/bloqueos');
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
       AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_FORMULARIOS_APP_ETHOS') = 0;
    IF l_ajenos > 0 THEN
      RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/' || l_rutas(i) ||
        ' ya existe y no es de este script: no se publico nada para no pisarla.');
    END IF;
  END LOOP;

  publicar('mis-formularios/postulaciones',
           'PKG_FORMULARIOS_APP_ETHOS.POSTULACIONES(p_token => l_token, p_anio => :anio);');
  publicar('mis-formularios/institucion',
           'PKG_FORMULARIOS_APP_ETHOS.INSTITUCION(p_token => l_token, p_id_institucion => :id_institucion, p_anio => :anio);');
  publicar('mis-formularios/intervenciones',
           'PKG_FORMULARIOS_APP_ETHOS.INTERVENCIONES(p_token => l_token, p_id_institucion => :id_institucion, p_desde => :desde, p_hasta => :hasta);');
  publicar('mis-formularios/bloqueos',
           'PKG_FORMULARIOS_APP_ETHOS.BLOQUEOS(p_token => l_token, p_anio => :anio);');
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 4 endpoints de ethos/mis-formularios.');
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
     AND t.URI_TEMPLATE LIKE 'mis-formularios/%'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_FORMULARIOS_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de mis-formularios publicados: ' || l_n || ' de 4.');

  SELECT COUNT(*) INTO l_n FROM USER_TABLES WHERE TABLE_NAME = 'FACILITADORES_DIAS_BLOQUEOS';
  IF l_n = 0 THEN
    DBMS_OUTPUT.PUT_LINE('[AVISO] No existe FACILITADORES_DIAS_BLOQUEOS: el Form. 3 sale sin horarios bloqueados.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   FACILITADORES_DIAS_BLOQUEOS encontrada.');
  END IF;
END;
/
