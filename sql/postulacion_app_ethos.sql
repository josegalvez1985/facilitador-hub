--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Mi postulacion": el facilitador se postula
-- para el año lectivo
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   0. Verificacion previa
--   1. Estructura: verifica que POSTULANTES_FACILITADORES ya tenga
--      ID_FACILITADOR con su FK e indice. NO crea ni cambia nada de la tabla:
--      la estructura la definio Jose (23/11/2026) y es la fuente de verdad.
--   2. Paquete PKG_POSTULACION_APP_ETHOS
--   3. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET  mi-postulacion
--        POST mi-postulacion
--        GET  mi-postulacion/lugares
--      No pisa nada: si alguna ruta ya existe y NO es de este paquete, se detiene.
--   4. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
--------------------------------------------------------------------------------
-- LA TABLA
--------------------------------------------------------------------------------
--
-- POSTULANTES_FACILITADORES: cada fila es la postulacion de una persona a un
-- año lectivo (formulario JV26 y, ahora, la app).
--
--   ID_FACILITADOR   Facilitador existente que se postula para seguir. NULL
--                    para postulantes nuevos (no vienen de la app).
--                    FK POSTULANTES_FAC_FK_FACILITADORES -> FACILITADORES.
--                    Indice IDX_POSTULANTES_FAC_FACILITADOR.
--
-- Desde la app, ID_FACILITADOR lo pone SIEMPRE el servidor a partir del token
-- (FACILITADORES.USUARIO = usuario del token), nunca el cliente: un facilitador
-- solo ve y carga SU postulacion.
--
-- FECHA_REGISTRO tiene DEFAULT SYSTIMESTAMP, que en oracleapex.com es hora UTC.
-- El paquete la graba con la hora de Paraguay (SYSDATE - 3/24), igual que
-- FECHA_HORA de INTERVENCIONES.
--
--------------------------------------------------------------------------------
-- REGLAS (Jose, 23/11/2026)
--------------------------------------------------------------------------------
--
-- - El año: el lectivo ACTUAL, FN_ANIO_LECTIVO_ACTUAL(), buscado en
--   ANIOS_LECTIVOS (ID_ANIO, ANIO). Si no esta en la tabla, no hay postulacion
--   abierta. Se cambia en un solo lugar: anio_abierto.
-- - UNA postulacion por facilitador y año, controlada aca (la tabla no tiene
--   indice unico): si ya existe, el POST la CORRIGE en vez de crear otra.
-- - Se puede corregir despues de enviarla, mientras sea el año abierto.
--   FECHA_REGISTRO queda la del primer envio.
-- - "No de acuerdo": no se envia nada. El POST solo acepta DE_ACUERDO.
-- - Pais por defecto: 1 (Paraguay).
-- - EDAD la calcula el servidor a partir de FECHA_NACIMIENTO.
-- - DIAS_DISPONIBLES: 'LUNES,MARTES,MIERCOLES,JUEVES,VIERNES' (los elegidos,
--   en el orden de la semana, sin tildes, como los otros codigos de la tabla).
-- - UBICACION_DOMICILIO: texto libre. La app manda 'latitud, longitud' del GPS
--   o el enlace de Google Maps que pegue el facilitador.
--
--------------------------------------------------------------------------------
-- CONTRATO
--------------------------------------------------------------------------------
--
--   GET  mi-postulacion
--        { success, es_facilitador, anio, abierta,
--          facilitador: { nombre, telefono, fecha_nacimiento },
--          postulacion: { ...la del año abierto }     (si ya la envio)
--          anterior:    { ...la mas reciente de otro año } (para precargar) }
--        Cada postulacion: { id, anio, fecha_registro ('YYYY-MM-DDTHH:MI'),
--          las columnas de la tabla en minuscula (fecha_nacimiento 'YYYY-MM-DD',
--          dias_disponibles como arreglo), departamento, ciudad }.
--
--   POST mi-postulacion   (JSON con las mismas claves; dias_disponibles arreglo)
--        200 { success, id, nueva, message }
--        400 { success:false, message, campo } · 403 no es facilitador
--        409 no hay año lectivo abierto
--
--   GET  mi-postulacion/lugares?id_pais=   (vacio = 1)
--        { success, id_pais, departamentos: [ { id, nombre,
--          ciudades: [ { id, nombre } ] } ] }
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 0. VERIFICACION PREVIA
--------------------------------------------------------------------------------

DECLARE
  l_n NUMBER;
BEGIN
  FOR o IN (SELECT 'POSTULANTES_FACILITADORES' AS nombre, 'TABLE' AS tipo FROM dual
            UNION ALL SELECT 'FACILITADORES', 'TABLE' FROM dual
            UNION ALL SELECT 'ANIOS_LECTIVOS', 'TABLE' FROM dual
            UNION ALL SELECT 'DEPARTAMENTOS', 'TABLE' FROM dual
            UNION ALL SELECT 'CIUDADES', 'TABLE' FROM dual
            UNION ALL SELECT 'PKG_AUTH_ETHOS', 'PACKAGE BODY' FROM dual) LOOP
    SELECT COUNT(*) INTO l_n FROM USER_OBJECTS
     WHERE OBJECT_NAME = o.nombre AND OBJECT_TYPE = o.tipo;
    IF l_n = 0 THEN
      DBMS_OUTPUT.PUT_LINE('[ERROR] Falta ' || o.nombre || ' (' || o.tipo || ').');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[OK]   ' || o.nombre || ' encontrado.');
    END IF;
  END LOOP;
END;
/

--------------------------------------------------------------------------------
-- 1. ESTRUCTURA (solo verifica; la tabla no se toca)
--------------------------------------------------------------------------------

DECLARE
  l_n PLS_INTEGER;
BEGIN
  SELECT COUNT(*) INTO l_n FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' AND COLUMN_NAME = 'ID_FACILITADOR';
  DBMS_OUTPUT.PUT_LINE(CASE WHEN l_n > 0 THEN '[OK]   ' ELSE '[ERROR] Falta ' END
                       || 'columna POSTULANTES_FACILITADORES.ID_FACILITADOR');

  SELECT COUNT(*) INTO l_n FROM USER_CONSTRAINTS
   WHERE CONSTRAINT_NAME = 'POSTULANTES_FAC_FK_FACILITADORES' AND STATUS = 'ENABLED';
  DBMS_OUTPUT.PUT_LINE(CASE WHEN l_n > 0 THEN '[OK]   ' ELSE '[ERROR] Falta ' END
                       || 'FK POSTULANTES_FAC_FK_FACILITADORES');

  SELECT COUNT(*) INTO l_n FROM USER_INDEXES
   WHERE INDEX_NAME = 'IDX_POSTULANTES_FAC_FACILITADOR' AND STATUS = 'VALID';
  DBMS_OUTPUT.PUT_LINE(CASE WHEN l_n > 0 THEN '[OK]   ' ELSE '[WARN] Falta ' END
                       || 'indice IDX_POSTULANTES_FAC_FACILITADOR');
END;
/

--------------------------------------------------------------------------------
-- 2. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_POSTULACION_APP_ETHOS AS

  PROCEDURE mi_postulacion(p_token IN VARCHAR2);

  PROCEDURE lugares(p_token IN VARCHAR2, p_id_pais IN VARCHAR2);

  -- p_body: el JSON del pedido (:body_text). Alta o correccion de la del año.
  PROCEDURE guardar(p_token IN VARCHAR2, p_body IN CLOB);

END PKG_POSTULACION_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_POSTULACION_APP_ETHOS AS

-- Constantes, excepciones y variables antes que cualquier procedimiento del body.
c_pais_defecto CONSTANT NUMBER       := 1;
c_dias         CONSTANT VARCHAR2(60) := 'LUNES,MARTES,MIERCOLES,JUEVES,VIERNES';
c_edad_minima  CONSTANT PLS_INTEGER  := 16;
c_edad_maxima  CONSTANT PLS_INTEGER  := 99;
c_largo_areas  CONSTANT PLS_INTEGER  := 4000;

-- Un dato invalido: falla() deja el campo y el mensaje y la lanza.
e_dato    EXCEPTION;
g_campo   VARCHAR2(60);
g_mensaje VARCHAR2(400);

-- Los encabezados CORS los pone ORDS: no repetirlos.
PROCEDURE abrir_json IS
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    HTP.P('Cache-Control: no-store');
    OWA_UTIL.HTTP_HEADER_CLOSE;
END abrir_json;

PROCEDURE p_error(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2,
                  p_campo IN VARCHAR2 DEFAULT NULL) IS
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

PROCEDURE falla(p_campo IN VARCHAR2, p_mensaje IN VARCHAR2) IS
BEGIN
    g_campo   := p_campo;
    g_mensaje := p_mensaje;
    RAISE e_dato;
END falla;

-- Ahora en Paraguay, como FECHA_HORA de INTERVENCIONES.
FUNCTION ahora RETURN DATE IS
BEGIN
    RETURN SYSDATE - 3/24;
END ahora;

-- Entero positivo, o NULL.
FUNCTION f_numero(p_valor IN VARCHAR2) RETURN NUMBER IS
    l_n NUMBER;
BEGIN
    l_n := TO_NUMBER(TRIM(p_valor));
    RETURN CASE WHEN l_n > 0 AND l_n = TRUNC(l_n) THEN l_n END;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END f_numero;

------------------------------------------------------------------------------
-- Contexto del token: su ID_FACILITADOR. Escribe el error y devuelve FALSE si
-- el token no sirve (401) o si se pide ser facilitador y no lo es (403).
------------------------------------------------------------------------------
FUNCTION contexto(p_token IN VARCHAR2, p_exigir_facilitador IN BOOLEAN,
                  o_id_facilitador OUT NUMBER) RETURN BOOLEAN IS
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
        WHEN OTHERS THEN o_id_facilitador := NULL;
    END;
    IF p_exigir_facilitador AND o_id_facilitador IS NULL THEN
        p_error(403, 'Forbidden', 'Tu usuario no es un facilitador');
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END contexto;

-- El año al que se postula: el lectivo actual. NULL si no esta en ANIOS_LECTIVOS.
PROCEDURE anio_abierto(o_id_anio OUT NUMBER, o_anio OUT VARCHAR2) IS
BEGIN
    o_anio := TO_CHAR(FN_ANIO_LECTIVO_ACTUAL());
    SELECT MIN(ID_ANIO) INTO o_id_anio FROM ANIOS_LECTIVOS WHERE TO_CHAR(ANIO) = o_anio;
EXCEPTION
    WHEN OTHERS THEN o_id_anio := NULL;
END anio_abierto;

/* -------------------------------------------------------------------------- */
/* Lectura del JSON del POST, con validacion                                  */
/* -------------------------------------------------------------------------- */

-- Texto de una linea: espacios repetidos juntados, sin espacios en los bordes.
FUNCTION texto(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2, p_largo IN PLS_INTEGER,
               p_requerido IN BOOLEAN DEFAULT TRUE) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767);
BEGIN
    l_v := TRIM(REGEXP_REPLACE(APEX_JSON.GET_VARCHAR2(p_path => p_campo), '[[:space:]]+', ' '));
    IF l_v IS NULL THEN
        IF p_requerido THEN falla(p_campo, 'Falta completar: ' || p_etiqueta); END IF;
        RETURN NULL;
    END IF;
    IF LENGTH(l_v) > p_largo THEN
        falla(p_campo, p_etiqueta || ': hasta ' || p_largo || ' caracteres');
    END IF;
    RETURN l_v;
END texto;

-- Uno de los codigos de p_valores ('A,B,C'), como los CHECK de la tabla.
FUNCTION opcion(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2, p_valores IN VARCHAR2,
                p_requerido IN BOOLEAN DEFAULT TRUE) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767);
BEGIN
    l_v := UPPER(TRIM(APEX_JSON.GET_VARCHAR2(p_path => p_campo)));
    IF l_v IS NULL THEN
        IF p_requerido THEN falla(p_campo, 'Falta elegir: ' || p_etiqueta); END IF;
        RETURN NULL;
    END IF;
    IF INSTR(',' || p_valores || ',', ',' || l_v || ',') = 0 THEN
        falla(p_campo, p_etiqueta || ': opcion no valida');
    END IF;
    RETURN l_v;
END opcion;

FUNCTION telefono(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767) := texto(p_campo, p_etiqueta, 30);
BEGIN
    IF NOT REGEXP_LIKE(l_v, '^\+?[0-9 ()-]{6,}$') THEN
        falla(p_campo, p_etiqueta || ': solo numeros, espacios, guiones o +');
    END IF;
    RETURN l_v;
END telefono;

-- Cedula paraguaya: solo numeros (se sacan puntos, espacios y guiones).
FUNCTION cedula(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767) := REGEXP_REPLACE(texto(p_campo, p_etiqueta, 20), '[. -]', '');
BEGIN
    IF NOT REGEXP_LIKE(l_v, '^[0-9]{3,15}$') THEN
        falla(p_campo, p_etiqueta || ': solo numeros');
    END IF;
    RETURN l_v;
END cedula;

-- Estado de un nivel de estudio, con su titulo (concluido o cursando) y, si
-- p_con_anio, el curso actual cuando lo esta cursando ('2/4').
PROCEDURE estudio(p_prefijo IN VARCHAR2, p_etiqueta IN VARCHAR2, p_valores IN VARCHAR2,
                  p_con_anio IN BOOLEAN,
                  o_estado OUT VARCHAR2, o_titulo OUT VARCHAR2, o_anio OUT VARCHAR2) IS
BEGIN
    o_estado := opcion(p_prefijo || '_estado', p_etiqueta, p_valores);
    o_titulo := NULL;
    o_anio   := NULL;
    IF o_estado IN ('CONCLUIDO', 'CONCLUIDA', 'CURSANDO') THEN
        o_titulo := texto(p_prefijo || '_titulo', 'titulo de ' || p_etiqueta, 200);
    END IF;
    IF p_con_anio AND o_estado = 'CURSANDO' THEN
        o_anio := REPLACE(texto(p_prefijo || '_anio', 'curso actual de ' || p_etiqueta, 10), ' ', '');
        IF NOT REGEXP_LIKE(o_anio, '^[0-9]{1,2}/[0-9]{1,2}$') THEN
            falla(p_prefijo || '_anio', 'Curso actual de ' || p_etiqueta || ': como 2/4 (el que cursas y el total)');
        END IF;
    END IF;
END estudio;

/* -------------------------------------------------------------------------- */
/* GET mi-postulacion                                                         */
/* -------------------------------------------------------------------------- */

PROCEDURE w(p_nombre IN VARCHAR2, p_valor IN VARCHAR2) IS
BEGIN
    APEX_JSON.WRITE(p_nombre, p_valor, p_write_null => TRUE);
END w;

PROCEDURE escribir(p_nombre IN VARCHAR2, p IN POSTULANTES_FACILITADORES%ROWTYPE) IS
    l_dep  VARCHAR2(4000);
    l_ciu  VARCHAR2(4000);
    l_anio VARCHAR2(40);
BEGIN
    SELECT MAX(NOMBRE) INTO l_dep FROM DEPARTAMENTOS
     WHERE ID_PAIS = p.ID_PAIS AND ID_DEPARTAMENTO = p.ID_DEPARTAMENTO;
    SELECT MAX(NOMBRE) INTO l_ciu FROM CIUDADES
     WHERE ID_PAIS = p.ID_PAIS AND ID_DEPARTAMENTO = p.ID_DEPARTAMENTO AND ID_CIUDAD = p.ID_CIUDAD;
    SELECT MAX(TO_CHAR(ANIO)) INTO l_anio FROM ANIOS_LECTIVOS WHERE ID_ANIO = p.ID_ANIO;

    APEX_JSON.OPEN_OBJECT(p_nombre);
    APEX_JSON.WRITE('id', p.ID);
    w('anio', l_anio);
    w('fecha_registro', TO_CHAR(p.FECHA_REGISTRO, 'YYYY-MM-DD"T"HH24:MI'));
    w('correo_electronico', p.CORREO_ELECTRONICO);
    w('acepta_proceso', p.ACEPTA_PROCESO);
    APEX_JSON.WRITE('id_pais', p.ID_PAIS);
    APEX_JSON.WRITE('id_departamento', p.ID_DEPARTAMENTO);
    APEX_JSON.WRITE('id_ciudad', p.ID_CIUDAD);
    w('departamento', l_dep);
    w('ciudad', l_ciu);
    w('direccion', p.DIRECCION);
    w('ubicacion_domicilio', p.UBICACION_DOMICILIO);
    w('nombre_completo', p.NOMBRE_COMPLETO);
    w('cedula', p.CEDULA);
    w('fecha_nacimiento', TO_CHAR(p.FECHA_NACIMIENTO, 'YYYY-MM-DD'));
    APEX_JSON.WRITE('edad', p.EDAD);
    w('estado_civil', p.ESTADO_CIVIL);
    w('estado_civil_otro', p.ESTADO_CIVIL_OTRO);
    w('vive_con', p.VIVE_CON);
    w('hijos', p.HIJOS);
    w('nacionalidad', p.NACIONALIDAD);
    w('telefono', p.TELEFONO);
    w('talle_remera', p.TALLE_REMERA);
    w('secundario_estado', p.SECUNDARIO_ESTADO);
    w('secundario_titulo', p.SECUNDARIO_TITULO);
    w('tecnico_estado', p.TECNICO_ESTADO);
    w('tecnico_titulo', p.TECNICO_TITULO);
    w('tecnico_anio', p.TECNICO_ANIO);
    w('licenciatura_estado', p.LICENCIATURA_ESTADO);
    w('licenciatura_titulo', p.LICENCIATURA_TITULO);
    w('licenciatura_anio', p.LICENCIATURA_ANIO);
    w('posgrado_estado', p.POSGRADO_ESTADO);
    w('posgrado_titulo', p.POSGRADO_TITULO);
    w('posgrado_anio', p.POSGRADO_ANIO);
    w('actividad_laboral', p.ACTIVIDAD_LABORAL);
    w('empresa', p.EMPRESA);
    w('cargo', p.CARGO);
    w('movilidad_propia', p.MOVILIDAD_PROPIA);
    w('tipo_vehiculo', p.TIPO_VEHICULO);
    w('computadora_propia', p.COMPUTADORA_PROPIA);
    w('internet_estable', p.INTERNET_ESTABLE);
    w('manejo_office', p.MANEJO_OFFICE);
    APEX_JSON.OPEN_ARRAY('dias_disponibles');
    FOR i IN 1 .. NVL(REGEXP_COUNT(p.DIAS_DISPONIBLES, '[^,]+'), 0) LOOP
        APEX_JSON.WRITE(UPPER(TRIM(REGEXP_SUBSTR(p.DIAS_DISPONIBLES, '[^,]+', 1, i))));
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;
    w('turno', p.TURNO);
    w('iglesia_denominacion', p.IGLESIA_DENOMINACION);
    w('iglesia_nombre', p.IGLESIA_NOMBRE);
    w('pastor_nombre', p.PASTOR_NOMBRE);
    w('pastor_telefono', p.PASTOR_TELEFONO);
    w('lider_nombre', p.LIDER_NOMBRE);
    w('lider_telefono', p.LIDER_TELEFONO);
    w('bautizado_agua', p.BAUTIZADO_AGUA);
    APEX_JSON.WRITE('areas_ministerio', p.AREAS_MINISTERIO, p_write_null => TRUE);
    w('banco_nombre', p.BANCO_NOMBRE);
    w('banco_sucursal', p.BANCO_SUCURSAL);
    w('titular_nombre', p.TITULAR_NOMBRE);
    w('titular_ci', p.TITULAR_CI);
    w('tipo_cuenta', p.TIPO_CUENTA);
    w('numero_cuenta', p.NUMERO_CUENTA);
    w('factura_tipo', p.FACTURA_TIPO);
    w('factura_emisor', p.FACTURA_EMISOR);
    w('ruc', p.RUC);
    APEX_JSON.CLOSE_OBJECT;
END escribir;

PROCEDURE mi_postulacion(p_token IN VARCHAR2) IS
    l_fac      NUMBER;
    l_id_anio  NUMBER;
    l_anio     VARCHAR2(40);
    l_actual   POSTULANTES_FACILITADORES%ROWTYPE;
    l_anterior POSTULANTES_FACILITADORES%ROWTYPE;
    l_hay_act  BOOLEAN := FALSE;
    l_hay_ant  BOOLEAN := FALSE;
BEGIN
    IF NOT contexto(p_token, FALSE, l_fac) THEN RETURN; END IF;
    anio_abierto(l_id_anio, l_anio);

    -- Solo SUS postulaciones (ID_FACILITADOR del token).
    IF l_fac IS NOT NULL THEN
        IF l_id_anio IS NOT NULL THEN
            BEGIN
                SELECT * INTO l_actual FROM POSTULANTES_FACILITADORES
                 WHERE ID_FACILITADOR = l_fac AND ID_ANIO = l_id_anio
                 ORDER BY ID DESC FETCH FIRST 1 ROWS ONLY;
                l_hay_act := TRUE;
            EXCEPTION
                WHEN NO_DATA_FOUND THEN NULL;
            END;
        END IF;
        BEGIN
            SELECT * INTO l_anterior FROM POSTULANTES_FACILITADORES
             WHERE ID_FACILITADOR = l_fac AND (l_id_anio IS NULL OR ID_ANIO <> l_id_anio)
             ORDER BY FECHA_REGISTRO DESC, ID DESC FETCH FIRST 1 ROWS ONLY;
            l_hay_ant := TRUE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN NULL;
        END;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    w('anio', l_anio);
    APEX_JSON.WRITE('abierta', l_id_anio IS NOT NULL);

    APEX_JSON.OPEN_OBJECT('facilitador');
    FOR f IN (SELECT NOMBRE_APELLIDO, TELEFONO, TO_CHAR(FECHA_NACIMIENTO, 'YYYY-MM-DD') AS nacimiento
                FROM FACILITADORES WHERE ID_FACILITADOR = l_fac) LOOP
        w('nombre', f.NOMBRE_APELLIDO);
        w('telefono', f.TELEFONO);
        w('fecha_nacimiento', f.nacimiento);
    END LOOP;
    APEX_JSON.CLOSE_OBJECT;

    IF l_hay_act THEN escribir('postulacion', l_actual); END IF;
    IF l_hay_ant THEN escribir('anterior', l_anterior); END IF;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END mi_postulacion;

/* -------------------------------------------------------------------------- */
/* GET mi-postulacion/lugares                                                 */
/* -------------------------------------------------------------------------- */

PROCEDURE lugares(p_token IN VARCHAR2, p_id_pais IN VARCHAR2) IS
    l_fac  NUMBER;
    l_pais NUMBER := NVL(f_numero(p_id_pais), c_pais_defecto);
BEGIN
    IF NOT contexto(p_token, TRUE, l_fac) THEN RETURN; END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('id_pais', l_pais);
    APEX_JSON.OPEN_ARRAY('departamentos');
    FOR d IN (SELECT ID_DEPARTAMENTO, NOMBRE FROM DEPARTAMENTOS
               WHERE ID_PAIS = l_pais ORDER BY NOMBRE) LOOP
        APEX_JSON.OPEN_OBJECT;
        APEX_JSON.WRITE('id', d.ID_DEPARTAMENTO);
        w('nombre', d.NOMBRE);
        APEX_JSON.OPEN_ARRAY('ciudades');
        FOR c IN (SELECT ID_CIUDAD, NOMBRE FROM CIUDADES
                   WHERE ID_PAIS = l_pais AND ID_DEPARTAMENTO = d.ID_DEPARTAMENTO
                   ORDER BY NOMBRE) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id', c.ID_CIUDAD);
            w('nombre', c.NOMBRE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
        APEX_JSON.CLOSE_ARRAY;
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END lugares;

/* -------------------------------------------------------------------------- */
/* POST mi-postulacion                                                        */
/* -------------------------------------------------------------------------- */

PROCEDURE guardar(p_token IN VARCHAR2, p_body IN CLOB) IS
    l_fac     NUMBER;
    l_id_anio NUMBER;
    l_anio    VARCHAR2(40);
    l_id      NUMBER;
    l_n       PLS_INTEGER;
    l_dia     VARCHAR2(4000);
    l_elegido VARCHAR2(4000) := ',';
    r         POSTULANTES_FACILITADORES%ROWTYPE;
BEGIN
    IF NOT contexto(p_token, TRUE, l_fac) THEN RETURN; END IF;

    anio_abierto(l_id_anio, l_anio);
    IF l_id_anio IS NULL THEN
        p_error(409, 'Conflict', 'No hay un año lectivo abierto para postularse'); RETURN;
    END IF;

    BEGIN
        APEX_JSON.PARSE(p_source => p_body);
    EXCEPTION
        WHEN OTHERS THEN
            p_error(400, 'Bad Request', 'Los datos enviados no son validos'); RETURN;
    END;

    -- 1. El proceso: sin acuerdo no se registra nada.
    IF opcion('acepta_proceso', 'acuerdo con el proceso', 'DE_ACUERDO,NO_DE_ACUERDO') <> 'DE_ACUERDO' THEN
        falla('acepta_proceso', 'Para postularte tenes que estar de acuerdo con el proceso');
    END IF;
    r.ACEPTA_PROCESO := 'DE_ACUERDO';

    -- 2. Datos personales.
    r.NOMBRE_COMPLETO := texto('nombre_completo', 'nombre completo', 200);
    r.CEDULA          := cedula('cedula', 'cedula');
    BEGIN
        r.FECHA_NACIMIENTO := TO_DATE(TRIM(APEX_JSON.GET_VARCHAR2(p_path => 'fecha_nacimiento')), 'FXYYYY-MM-DD');
    EXCEPTION
        WHEN OTHERS THEN r.FECHA_NACIMIENTO := NULL;
    END;
    IF r.FECHA_NACIMIENTO IS NULL THEN
        falla('fecha_nacimiento', 'Falta la fecha de nacimiento');
    END IF;
    r.EDAD := TRUNC(MONTHS_BETWEEN(TRUNC(ahora), r.FECHA_NACIMIENTO) / 12);
    IF r.EDAD < c_edad_minima OR r.EDAD > c_edad_maxima THEN
        falla('fecha_nacimiento', 'Revisa la fecha de nacimiento');
    END IF;
    r.NACIONALIDAD       := texto('nacionalidad', 'nacionalidad', 100);
    r.TELEFONO           := telefono('telefono', 'telefono');
    r.CORREO_ELECTRONICO := LOWER(texto('correo_electronico', 'correo electronico', 200));
    IF NOT REGEXP_LIKE(r.CORREO_ELECTRONICO, '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
        falla('correo_electronico', 'El correo electronico no es valido');
    END IF;
    r.ESTADO_CIVIL := opcion('estado_civil', 'estado civil', 'SOLTERO,CASADO,OTROS');
    IF r.ESTADO_CIVIL = 'OTROS' THEN
        r.ESTADO_CIVIL_OTRO := texto('estado_civil_otro', 'cual es tu estado civil', 100);
    END IF;
    r.VIVE_CON     := opcion('vive_con', 'con quien vivis', 'SOLO,PADRES,CONYUGE,OTROS');
    r.HIJOS        := opcion('hijos', 'si tenes hijos', 'SI,NO');
    r.TALLE_REMERA := opcion('talle_remera', 'talle de remera', 'P,M,G,XG,XXG,XXXG,XXXXG,XXXXXG', FALSE);

    -- 3. Domicilio (el pais, por defecto Paraguay).
    r.ID_PAIS         := NVL(f_numero(APEX_JSON.GET_VARCHAR2(p_path => 'id_pais')), c_pais_defecto);
    r.ID_DEPARTAMENTO := f_numero(APEX_JSON.GET_VARCHAR2(p_path => 'id_departamento'));
    IF r.ID_DEPARTAMENTO IS NULL THEN
        falla('id_departamento', 'Falta elegir el departamento');
    END IF;
    r.ID_CIUDAD := f_numero(APEX_JSON.GET_VARCHAR2(p_path => 'id_ciudad'));
    IF r.ID_CIUDAD IS NULL THEN
        falla('id_ciudad', 'Falta elegir la ciudad');
    END IF;
    SELECT COUNT(*) INTO l_n FROM CIUDADES
     WHERE ID_PAIS = r.ID_PAIS AND ID_DEPARTAMENTO = r.ID_DEPARTAMENTO AND ID_CIUDAD = r.ID_CIUDAD;
    IF l_n = 0 THEN
        falla('id_ciudad', 'La ciudad no es del departamento elegido');
    END IF;
    r.DIRECCION           := texto('direccion', 'direccion', 300);
    r.UBICACION_DOMICILIO := texto('ubicacion_domicilio', 'ubicacion del domicilio', 300);

    -- 4. Estudios (cada nivel con sus propios codigos, como los CHECK).
    estudio('secundario', 'secundaria', 'CONCLUIDO,INCONCLUSO', FALSE,
            r.SECUNDARIO_ESTADO, r.SECUNDARIO_TITULO, l_dia);
    estudio('tecnico', 'tecnico superior', 'CONCLUIDO,CURSANDO,NO,INCONCLUSO', TRUE,
            r.TECNICO_ESTADO, r.TECNICO_TITULO, r.TECNICO_ANIO);
    estudio('licenciatura', 'licenciatura', 'CONCLUIDA,CURSANDO,NO,INCONCLUSA', TRUE,
            r.LICENCIATURA_ESTADO, r.LICENCIATURA_TITULO, r.LICENCIATURA_ANIO);
    estudio('posgrado', 'posgrado', 'CONCLUIDO,CURSANDO,NO,INCONCLUSA', TRUE,
            r.POSGRADO_ESTADO, r.POSGRADO_TITULO, r.POSGRADO_ANIO);

    -- 5. Trabajo y recursos.
    r.ACTIVIDAD_LABORAL := opcion('actividad_laboral', 'si trabajas actualmente', 'SI,NO');
    IF r.ACTIVIDAD_LABORAL = 'SI' THEN
        r.EMPRESA := texto('empresa', 'empresa donde trabajas', 200);
        r.CARGO   := texto('cargo', 'cargo', 200);
    END IF;
    r.MOVILIDAD_PROPIA := opcion('movilidad_propia', 'si tenes movilidad propia', 'SI,NO');
    IF r.MOVILIDAD_PROPIA = 'SI' THEN
        r.TIPO_VEHICULO := opcion('tipo_vehiculo', 'tipo de vehiculo', 'AUTO,MOTOCICLETA');
    END IF;
    r.COMPUTADORA_PROPIA := opcion('computadora_propia', 'si tenes computadora propia', 'SI,NO');
    r.INTERNET_ESTABLE   := opcion('internet_estable', 'si tenes internet estable', 'SI,NO');
    r.MANEJO_OFFICE      := opcion('manejo_office', 'si manejas Office', 'SI,NO');

    -- 6. Disponibilidad: los dias elegidos, en el orden de la semana.
    FOR i IN 1 .. NVL(APEX_JSON.GET_COUNT(p_path => 'dias_disponibles'), 0) LOOP
        l_dia := UPPER(TRIM(APEX_JSON.GET_VARCHAR2(p_path => 'dias_disponibles[%d]', p0 => i)));
        IF INSTR(',' || c_dias || ',', ',' || l_dia || ',') = 0 THEN
            falla('dias_disponibles', 'Dia no valido: ' || l_dia);
        END IF;
        l_elegido := l_elegido || l_dia || ',';
    END LOOP;
    FOR i IN 1 .. 5 LOOP
        l_dia := REGEXP_SUBSTR(c_dias, '[^,]+', 1, i);
        IF INSTR(l_elegido, ',' || l_dia || ',') > 0 THEN
            r.DIAS_DISPONIBLES := r.DIAS_DISPONIBLES
                                  || CASE WHEN r.DIAS_DISPONIBLES IS NOT NULL THEN ',' END || l_dia;
        END IF;
    END LOOP;
    IF r.DIAS_DISPONIBLES IS NULL THEN
        falla('dias_disponibles', 'Elegi al menos un dia');
    END IF;
    r.TURNO := opcion('turno', 'turno', 'MANANA,TARDE,MANANA_Y_TARDE');

    -- 7. Iglesia.
    r.IGLESIA_DENOMINACION := texto('iglesia_denominacion', 'denominacion de tu iglesia', 200);
    r.IGLESIA_NOMBRE       := texto('iglesia_nombre', 'nombre de tu iglesia', 200);
    r.PASTOR_NOMBRE        := texto('pastor_nombre', 'nombre del pastor', 200);
    r.PASTOR_TELEFONO      := telefono('pastor_telefono', 'telefono del pastor');
    r.LIDER_NOMBRE         := texto('lider_nombre', 'nombre de tu lider', 200);
    r.LIDER_TELEFONO       := telefono('lider_telefono', 'telefono de tu lider');
    r.BAUTIZADO_AGUA       := opcion('bautizado_agua', 'si estas bautizado en agua', 'SI,NO');
    r.AREAS_MINISTERIO     := TRIM(APEX_JSON.GET_CLOB(p_path => 'areas_ministerio'));
    IF r.AREAS_MINISTERIO IS NULL OR DBMS_LOB.GETLENGTH(r.AREAS_MINISTERIO) = 0 THEN
        falla('areas_ministerio', 'Falta completar: areas en las que servis');
    END IF;
    IF DBMS_LOB.GETLENGTH(r.AREAS_MINISTERIO) > c_largo_areas THEN
        falla('areas_ministerio', 'Areas en las que servis: hasta ' || c_largo_areas || ' caracteres');
    END IF;

    -- 8. Cobro.
    r.BANCO_NOMBRE   := texto('banco_nombre', 'banco', 100);
    r.BANCO_SUCURSAL := texto('banco_sucursal', 'sucursal', 100);
    r.TITULAR_NOMBRE := texto('titular_nombre', 'titular de la cuenta', 200);
    r.TITULAR_CI     := cedula('titular_ci', 'cedula del titular');
    r.TIPO_CUENTA    := texto('tipo_cuenta', 'tipo de cuenta', 50);
    r.NUMERO_CUENTA  := texto('numero_cuenta', 'numero de cuenta', 50);
    r.FACTURA_TIPO   := opcion('factura_tipo', 'tipo de factura', 'VIRTUAL,FISICA');
    r.FACTURA_EMISOR := texto('factura_emisor', 'emisor de la factura', 200);
    r.RUC            := REPLACE(texto('ruc', 'RUC', 30), ' ', '');
    IF NOT REGEXP_LIKE(r.RUC, '^[0-9]{3,}(-[0-9])?$') THEN
        falla('ruc', 'El RUC va como 1234567-8');
    END IF;

    -- Una por facilitador y año: la fila del facilitador bloqueada hasta el
    -- COMMIT, asi dos envios a la vez no crean dos postulaciones.
    SELECT ID_FACILITADOR INTO l_fac FROM FACILITADORES WHERE ID_FACILITADOR = l_fac FOR UPDATE;
    SELECT MAX(ID) INTO l_id FROM POSTULANTES_FACILITADORES
     WHERE ID_FACILITADOR = l_fac AND ID_ANIO = l_id_anio;

    r.ID_FACILITADOR := l_fac;
    r.ID_ANIO        := l_id_anio;
    IF l_id IS NULL THEN
        r.ID             := NULL;
        r.FECHA_REGISTRO := CAST(ahora AS TIMESTAMP);
        INSERT INTO POSTULANTES_FACILITADORES VALUES r RETURNING ID INTO l_id;
    ELSE
        -- Correccion: queda la fecha del primer envio.
        SELECT FECHA_REGISTRO INTO r.FECHA_REGISTRO FROM POSTULANTES_FACILITADORES WHERE ID = l_id;
        r.ID := l_id;
        UPDATE POSTULANTES_FACILITADORES SET ROW = r WHERE ID = l_id;
    END IF;
    COMMIT;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('id', l_id);
    APEX_JSON.WRITE('nueva', r.ID IS NULL);
    APEX_JSON.WRITE('message', CASE WHEN r.ID IS NULL THEN 'Postulacion enviada' ELSE 'Postulacion actualizada' END);
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN e_dato THEN
        ROLLBACK;
        p_error(400, 'Bad Request', g_mensaje, g_campo);
    WHEN OTHERS THEN
        ROLLBACK;
        IF SQLCODE = -2290 THEN
            p_error(400, 'Bad Request', 'Hay una opcion no valida: ' || SQLERRM);
        ELSIF SQLCODE = -2291 THEN
            p_error(400, 'Bad Request', 'El departamento o la ciudad no existen', 'id_ciudad');
        ELSE
            p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
        END IF;
END guardar;

END PKG_POSTULACION_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_POSTULACION_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_POSTULACION_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_POSTULACION_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_POSTULACION_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 3. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  TYPE t_rutas IS TABLE OF VARCHAR2(100);
  l_rutas t_rutas := t_rutas('mi-postulacion', 'mi-postulacion/lugares');
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

  PROCEDURE publicar(p_pattern IN VARCHAR2, p_method IN VARCHAR2, p_llamada IN VARCHAR2,
                     p_priority IN NUMBER DEFAULT 0) IS
    l_existe NUMBER;
  BEGIN
    BEGIN ORDS.DELETE_HANDLER('ethos', p_pattern, p_method); EXCEPTION WHEN OTHERS THEN NULL; END;
    -- La ruta se crea SOLO si no existe: ORDS.DEFINE_TEMPLATE sobre una ruta que ya existe la
    -- REEMPLAZA y borra sus handlers (mi-postulacion tiene GET y POST). Paso con mis-facturas.
    SELECT COUNT(*) INTO l_existe
      FROM USER_ORDS_TEMPLATES t
      JOIN USER_ORDS_MODULES   m ON m.ID = t.MODULE_ID
     WHERE m.NAME = 'ethos' AND t.URI_TEMPLATE = p_pattern;
    IF l_existe = 0 THEN
      ORDS.DEFINE_TEMPLATE(p_module_name => 'ethos', p_pattern => p_pattern,
                           p_priority => p_priority, p_etag_type => 'NONE');
    END IF;
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
       AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_POSTULACION_APP_ETHOS') = 0;
    IF l_ajenos > 0 THEN
      RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/' || l_rutas(i) ||
        ' ya existe y no es de este script: no se publico nada para no pisarla.');
    END IF;
  END LOOP;

  publicar('mi-postulacion', 'GET',
           'PKG_POSTULACION_APP_ETHOS.MI_POSTULACION(p_token => l_token);');
  -- El JSON entero en :body_text (son ~60 campos): lo lee el paquete con APEX_JSON.
  publicar('mi-postulacion', 'POST',
           'PKG_POSTULACION_APP_ETHOS.GUARDAR(p_token => l_token, p_body => :body_text);');
  publicar('mi-postulacion/lugares', 'GET',
           'PKG_POSTULACION_APP_ETHOS.LUGARES(p_token => l_token, p_id_pais => :id_pais);', 1);
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 3 endpoints de ethos/mi-postulacion.');
END;
/

--------------------------------------------------------------------------------
-- 4. VERIFICACION
--------------------------------------------------------------------------------

DECLARE
  l_n       NUMBER;
  l_id_anio NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_n
    FROM USER_ORDS_HANDLERS h
    JOIN USER_ORDS_TEMPLATES t ON t.ID = h.TEMPLATE_ID
    JOIN USER_ORDS_MODULES   m ON m.ID = t.MODULE_ID
   WHERE m.NAME = 'ethos'
     AND t.URI_TEMPLATE LIKE 'mi-postulacion%'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_POSTULACION_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de mi-postulacion publicados: ' || l_n || ' de 3.');

  SELECT MIN(ID_ANIO) INTO l_id_anio FROM ANIOS_LECTIVOS
   WHERE TO_CHAR(ANIO) = TO_CHAR(FN_ANIO_LECTIVO_ACTUAL());
  IF l_id_anio IS NULL THEN
    DBMS_OUTPUT.PUT_LINE('[WARN] El año lectivo actual (' || FN_ANIO_LECTIVO_ACTUAL()
                         || ') no esta en ANIOS_LECTIVOS: la app mostrara "no hay postulacion abierta".');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   Postulacion abierta para ' || FN_ANIO_LECTIVO_ACTUAL()
                         || ' (ID_ANIO ' || l_id_anio || ').');
  END IF;

  SELECT COUNT(*) INTO l_n FROM DEPARTAMENTOS WHERE ID_PAIS = 1;
  DBMS_OUTPUT.PUT_LINE('[INFO] Departamentos de Paraguay (ID_PAIS 1): ' || l_n || '.');
END;
/
