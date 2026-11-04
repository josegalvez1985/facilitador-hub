--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Mis facturas": el facilitador sube su factura
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   1. Paquete PKG_FACTURAS_APP_ETHOS
--   2. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET    mis-facturas
--        POST   mis-facturas
--        PUT    mis-facturas/:id
--        DELETE mis-facturas/:id
--        POST   mis-facturas/firma-foto
--      No pisa nada: si alguna ruta ya existe y NO es de este paquete, se detiene.
--   3. Verificacion
--
-- COMO CORRERLO
--   APEX -> SQL Workshop -> SQL Scripts -> Upload -> Run, con el usuario dueño
--   del esquema (WKSP_FUNDCARAC).
--
-- ANTES, EN EL MISMO ESQUEMA (son del sitio editorial-ethos-app, ya corridos):
--   - backend/cloudinary.sql            PKG_CLOUDINARY_ETHOS (firma y valida la foto)
--   - backend/facturas_facilitadores.sql la tabla FACTURAS_FACILITADORES con FOTO_URL
--
--------------------------------------------------------------------------------
-- COMO FUNCIONA
--------------------------------------------------------------------------------
--
-- MISMA TABLA que el sitio: FACTURAS_FACILITADORES. El facilitador SUBE su
-- factura fisica (la foto) y completa numero, timbrado, fecha y el MES que
-- cubre; el administrador la CONTROLA desde Totales por Facilitador del sitio.
--
-- El ID_FACILITADOR sale del TOKEN (FACILITADORES.USUARIO = usuario del token),
-- nunca del cliente: un facilitador no ve ni toca facturas de otro.
--
-- "POR REVISAR" = CANTIDAD = 0. Sin columnas nuevas (decision del 04/11/2026):
--   - El facilitador la guarda con CANTIDAD, SUELDO y MONTO en 0: no conoce ni
--     ve montos.
--   - El administrador la abre en el sitio, completa cantidad y sueldo (el
--     formulario le propone lo que da el reporte) y guarda. El paquete del
--     sitio exige CANTIDAD >= 1, asi que guardarla ahi la deja REVISADA.
--   - Mientras este por revisar, el facilitador la puede corregir o borrar.
--     Revisada, ya no: queda como se pago.
--
-- EL PERIODO ES UN MES: FECHA_DESDE = el 1, FECHA_HASTA = el ultimo dia. Las
-- mismas reglas del sitio: una factura por facilitador y periodo (dos no se
-- pisan) y un numero no se repite para el mismo facilitador y timbrado.
--
-- LA FOTO ES OBLIGATORIA en el alta y se sube DIRECTO de la app a Cloudinary
-- (camara o galeria), con la firma de POST mis-facturas/firma-foto (el preset
-- es Signed y el secreto queda en Oracle). Solo se acepta un enlace de NUESTRO
-- cloud. Sin lectura con IA (Jose, 04/11/2026): el facilitador escribe los datos.
--
--------------------------------------------------------------------------------
-- CONTRATO
--------------------------------------------------------------------------------
--
--   GET    mis-facturas
--          { success, es_facilitador, fotos_habilitadas,
--            data: [ { id_factura, nro_factura, timbrado, fecha_factura,
--                      anio, mes, fecha_desde, fecha_hasta, foto_url,
--                      revisada, cargado_el } ] }
--          Sin cantidad, sueldo ni monto. Las mas nuevas primero.
--
--   POST   mis-facturas
--          { nro_factura, timbrado, fecha_factura, anio, mes, foto_url }
--          200 { success, id_factura, nro_factura }
--          400 { success:false, message, campo } · 403 no es facilitador
--          409 numero repetido o mes ya facturado
--
--   PUT    mis-facturas/:id      lo mismo; foto_url vacio deja la que habia.
--          404 si no es suya · 409 si ya esta revisada
--
--   DELETE mis-facturas/:id      404 si no es suya · 409 si ya esta revisada
--
--   POST   mis-facturas/firma-foto
--          { success, cloud_name, upload_url, campos:{ api_key, timestamp,
--            upload_preset, asset_folder, signature } }
--          503 si Cloudinary no esta configurado
--
--   Las fechas 'YYYY-MM-DD'. nro_factura con el formato 001-001-0000123 (se
--   acepta tambien con los 13 digitos juntos o sin los ceros: 1-1-123).
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- 0. VERIFICACION PREVIA
--------------------------------------------------------------------------------

DECLARE
  l_n NUMBER;
BEGIN
  FOR o IN (SELECT 'PKG_AUTH_ETHOS' AS nombre, 'PACKAGE BODY' AS tipo FROM dual
            UNION ALL SELECT 'PKG_CLOUDINARY_ETHOS', 'PACKAGE BODY' FROM dual
            UNION ALL SELECT 'FACTURAS_FACILITADORES', 'TABLE' FROM dual) LOOP
    SELECT COUNT(*) INTO l_n FROM USER_OBJECTS
     WHERE OBJECT_NAME = o.nombre AND OBJECT_TYPE = o.tipo;
    IF l_n = 0 THEN
      DBMS_OUTPUT.PUT_LINE('[ERROR] Falta ' || o.nombre || ': corre antes cloudinary.sql y '
                           || 'facturas_facilitadores.sql del sitio.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[OK]   ' || o.nombre || ' encontrado.');
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO l_n FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'FACTURAS_FACILITADORES' AND COLUMN_NAME = 'FOTO_URL';
  IF l_n = 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] FACTURAS_FACILITADORES no tiene FOTO_URL: corre '
                         || 'facturas_facilitadores.sql del sitio.');
  END IF;

END;
/

--------------------------------------------------------------------------------
-- 1. PAQUETE
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_FACTURAS_APP_ETHOS AS

  PROCEDURE mis_facturas(p_token IN VARCHAR2);

  -- p_id NULL = alta.
  PROCEDURE guardar(
    p_token         IN VARCHAR2,
    p_id            IN VARCHAR2,
    p_nro_factura   IN VARCHAR2,
    p_timbrado      IN VARCHAR2,
    p_fecha_factura IN VARCHAR2,
    p_anio          IN VARCHAR2,
    p_mes           IN VARCHAR2,
    p_foto_url      IN VARCHAR2);

  PROCEDURE eliminar(p_token IN VARCHAR2, p_id IN VARCHAR2);

  PROCEDURE firma_foto(p_token IN VARCHAR2);


END PKG_FACTURAS_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_FACTURAS_APP_ETHOS AS

-- Constantes antes que cualquier procedimiento del body.
c_largo_timbr  CONSTANT PLS_INTEGER  := 20;
c_largo_foto   CONSTANT PLS_INTEGER  := 1000;
c_carpeta_foto CONSTANT VARCHAR2(40) := 'facturas-facilitadores';
c_anio_minimo  CONSTANT PLS_INTEGER  := 2024;

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

-- Hoy en Paraguay, como el resto de la app.
FUNCTION hoy RETURN DATE IS
BEGIN
    RETURN TRUNC(SYSDATE - 3/24);
END hoy;

FUNCTION nombre_mes(p_mes IN NUMBER) RETURN VARCHAR2 IS
BEGIN
    RETURN CASE p_mes
      WHEN 1 THEN 'enero' WHEN 2 THEN 'febrero' WHEN 3 THEN 'marzo' WHEN 4 THEN 'abril'
      WHEN 5 THEN 'mayo' WHEN 6 THEN 'junio' WHEN 7 THEN 'julio' WHEN 8 THEN 'agosto'
      WHEN 9 THEN 'septiembre' WHEN 10 THEN 'octubre' WHEN 11 THEN 'noviembre'
      ELSE 'diciembre' END;
END nombre_mes;

-- Entero positivo, o NULL.
FUNCTION f_numero(p_valor IN VARCHAR2) RETURN NUMBER IS
    l_n NUMBER;
BEGIN
    l_n := TO_NUMBER(TRIM(p_valor));
    RETURN CASE WHEN l_n > 0 AND l_n = TRUNC(l_n) THEN l_n END;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END f_numero;

FUNCTION f_fecha(p_valor IN VARCHAR2) RETURN DATE IS
BEGIN
    RETURN TO_DATE(SUBSTR(TRIM(p_valor), 1, 10), 'YYYY-MM-DD');
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END f_fecha;

-- La misma regla que PKG_FACTURAS_FACIL_ETHOS (el sitio): 001-001-0000123.
FUNCTION f_nro_factura(p_valor IN VARCHAR2) RETURN VARCHAR2 IS
    l_v VARCHAR2(4000) := REGEXP_REPLACE(TRIM(p_valor), '\s+', '');
BEGIN
    IF REGEXP_LIKE(l_v, '^[0-9]{13}$') THEN
        RETURN SUBSTR(l_v, 1, 3) || '-' || SUBSTR(l_v, 4, 3) || '-' || SUBSTR(l_v, 7, 7);
    END IF;
    IF REGEXP_LIKE(l_v, '^[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,7}$') THEN
        RETURN LPAD(REGEXP_SUBSTR(l_v, '[0-9]+', 1, 1), 3, '0') || '-'
            || LPAD(REGEXP_SUBSTR(l_v, '[0-9]+', 1, 2), 3, '0') || '-'
            || LPAD(REGEXP_SUBSTR(l_v, '[0-9]+', 1, 3), 7, '0');
    END IF;
    RETURN NULL;
END f_nro_factura;

-- Borra de Cloudinary una foto que ya no usa ninguna factura. NULL si quedo
-- borrada (o no habia nada); si no, el motivo. Va DESPUES del COMMIT y nunca
-- lanza: ver PKG_CLOUDINARY_ETHOS.borrar (backend/cloudinary.sql del sitio).
--
-- Se llama con SQL DINAMICO a proposito: BORRAR es una funcion nueva del sitio
-- (commit "fotos de facturas") y un PKG_CLOUDINARY_ETHOS anterior no la tiene.
-- Con la llamada directa este paquete no compilaba (PLS-00302) y se caia todo
-- mis-facturas. Asi compila igual: si BORRAR no existe, la foto vieja queda en
-- Cloudinary y la factura se guarda o se borra igual.
FUNCTION limpiar_foto(p_url IN VARCHAR2) RETURN VARCHAR2 IS
    l_n         PLS_INTEGER;
    l_resultado VARCHAR2(4000);
    e_sin_borrar EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_sin_borrar, -6550);   -- el bloque no compila: falta BORRAR
BEGIN
    IF p_url IS NULL THEN RETURN NULL; END IF;
    SELECT COUNT(*) INTO l_n FROM FACTURAS_FACILITADORES WHERE FOTO_URL = p_url;
    IF l_n > 0 THEN RETURN NULL; END IF;
    EXECUTE IMMEDIATE 'BEGIN :r := PKG_CLOUDINARY_ETHOS.borrar(:u); END;'
        USING OUT l_resultado, IN p_url;
    RETURN l_resultado;
EXCEPTION
    WHEN e_sin_borrar THEN
        RETURN 'PKG_CLOUDINARY_ETHOS no tiene BORRAR (falta correr el cloudinary.sql nuevo del sitio)';
    WHEN OTHERS THEN RETURN SQLERRM;
END limpiar_foto;


------------------------------------------------------------------------------
-- Contexto del token: el usuario y su ID_FACILITADOR. Escribe el error y
-- devuelve FALSE si el token no sirve (401) o si se pide ser facilitador y no
-- lo es (403).
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

/* -------------------------------------------------------------------------- */
/* GET mis-facturas                                                           */
/* -------------------------------------------------------------------------- */

PROCEDURE mis_facturas(p_token IN VARCHAR2) IS
    l_fac NUMBER;
BEGIN
    IF NOT contexto(p_token, FALSE, l_fac) THEN RETURN; END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    APEX_JSON.WRITE('fotos_habilitadas', PKG_CLOUDINARY_ETHOS.falta IS NULL);
    APEX_JSON.OPEN_ARRAY('data');

    IF l_fac IS NOT NULL THEN
        -- Cuando la cargo: de la bitacora, en hora de Paraguay.
        FOR c IN (
            SELECT f.ID_FACTURA, f.NRO_FACTURA, f.TIMBRADO, f.FOTO_URL, f.CANTIDAD,
                   TO_CHAR(f.FECHA_FACTURA, 'YYYY-MM-DD') AS fecha_factura,
                   TO_CHAR(f.FECHA_DESDE, 'YYYY-MM-DD') AS fecha_desde,
                   TO_CHAR(f.FECHA_HASTA, 'YYYY-MM-DD') AS fecha_hasta,
                   EXTRACT(YEAR FROM f.FECHA_DESDE) AS anio,
                   EXTRACT(MONTH FROM f.FECHA_DESDE) AS mes,
                   (SELECT TO_CHAR(MIN(j.JN_DATETIME) - 3/24, 'YYYY-MM-DD"T"HH24:MI')
                      FROM FACTURAS_FACILITADORES_JN j
                     WHERE j.ID_AUDITORIA = f.ID_AUDITORIA
                       AND j.JN_OPERATION = 'INS') AS cargado_el
              FROM FACTURAS_FACILITADORES f
             WHERE f.ID_FACILITADOR = l_fac
             ORDER BY f.FECHA_DESDE DESC, f.ID_FACTURA DESC
        ) LOOP
            APEX_JSON.OPEN_OBJECT;
            APEX_JSON.WRITE('id_factura', c.ID_FACTURA);
            APEX_JSON.WRITE('nro_factura', c.NRO_FACTURA);
            APEX_JSON.WRITE('timbrado', c.TIMBRADO, p_write_null => TRUE);
            APEX_JSON.WRITE('fecha_factura', c.fecha_factura);
            APEX_JSON.WRITE('anio', c.anio);
            APEX_JSON.WRITE('mes', c.mes);
            APEX_JSON.WRITE('fecha_desde', c.fecha_desde);
            APEX_JSON.WRITE('fecha_hasta', c.fecha_hasta);
            APEX_JSON.WRITE('foto_url', c.FOTO_URL, p_write_null => TRUE);
            -- Revisada = el administrador ya puso la cantidad (ver el encabezado).
            APEX_JSON.WRITE('revisada', NVL(c.CANTIDAD, 0) > 0);
            APEX_JSON.WRITE('cargado_el', c.cargado_el, p_write_null => TRUE);
            APEX_JSON.CLOSE_OBJECT;
        END LOOP;
    END IF;

    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END mis_facturas;

/* -------------------------------------------------------------------------- */
/* POST mis-facturas  /  PUT mis-facturas/:id                                 */
/* -------------------------------------------------------------------------- */

PROCEDURE guardar(
    p_token         IN VARCHAR2,
    p_id            IN VARCHAR2,
    p_nro_factura   IN VARCHAR2,
    p_timbrado      IN VARCHAR2,
    p_fecha_factura IN VARCHAR2,
    p_anio          IN VARCHAR2,
    p_mes           IN VARCHAR2,
    p_foto_url      IN VARCHAR2)
IS
    l_fac      NUMBER;
    l_id       NUMBER := f_numero(p_id);
    l_nro      VARCHAR2(15);
    -- 32767: el tope real se valida abajo con mensaje.
    l_timbrado VARCHAR2(32767) := REGEXP_REPLACE(TRIM(p_timbrado), '\s+', '');
    l_foto     VARCHAR2(32767) := TRIM(p_foto_url);
    l_fecha    DATE   := f_fecha(p_fecha_factura);
    l_anio     NUMBER := f_numero(p_anio);
    l_mes      NUMBER := f_numero(p_mes);
    l_desde    DATE;
    l_hasta    DATE;
    l_cantidad NUMBER;
    l_n        PLS_INTEGER;
    l_otra     FACTURAS_FACILITADORES%ROWTYPE;
    -- La foto que tenia: si se reemplaza, se borra de Cloudinary.
    l_foto_vieja FACTURAS_FACILITADORES.FOTO_URL%TYPE;
    l_aviso      VARCHAR2(4000);
BEGIN
    IF NOT contexto(p_token, TRUE, l_fac) THEN RETURN; END IF;

    IF p_id IS NOT NULL AND l_id IS NULL THEN
        p_error(400, 'Bad Request', 'Id de factura invalido'); RETURN;
    END IF;

    -- La fila del facilitador bloqueada hasta el COMMIT: dos altas a la vez
    -- (o un alta del sitio y una de la app) no pasan juntas el control de
    -- superposicion. Es el mismo bloqueo que usa el paquete del sitio.
    SELECT ID_FACILITADOR INTO l_fac FROM FACILITADORES WHERE ID_FACILITADOR = l_fac FOR UPDATE;

    -- Una modificacion: tiene que ser suya y estar por revisar.
    IF l_id IS NOT NULL THEN
        BEGIN
            SELECT CANTIDAD, FOTO_URL INTO l_cantidad, l_foto_vieja FROM FACTURAS_FACILITADORES
             WHERE ID_FACTURA = l_id AND ID_FACILITADOR = l_fac
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                ROLLBACK;
                p_error(404, 'Not Found', 'La factura no existe'); RETURN;
        END;
        IF NVL(l_cantidad, 0) > 0 THEN
            ROLLBACK;
            p_error(409, 'Conflict', 'La factura ya fue revisada: no se puede modificar'); RETURN;
        END IF;
    END IF;

    -- Numero y timbrado.
    IF TRIM(p_nro_factura) IS NULL THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'El numero de factura es obligatorio', 'nro_factura'); RETURN;
    END IF;
    l_nro := f_nro_factura(p_nro_factura);
    IF l_nro IS NULL THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'El numero de factura va con el formato 001-001-0000123',
                'nro_factura');
        RETURN;
    END IF;
    IF l_timbrado IS NOT NULL THEN
        IF NOT REGEXP_LIKE(l_timbrado, '^[0-9]+$') THEN
            ROLLBACK;
            p_error(400, 'Bad Request', 'El timbrado lleva solo numeros', 'timbrado'); RETURN;
        END IF;
        IF LENGTH(l_timbrado) > c_largo_timbr THEN
            ROLLBACK;
            p_error(400, 'Bad Request', 'El timbrado no puede pasar de ' || c_largo_timbr
                    || ' digitos', 'timbrado');
            RETURN;
        END IF;
    END IF;

    -- Fecha de la factura: obligatoria y no en el futuro.
    IF l_fecha IS NULL THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'La fecha de la factura es obligatoria', 'fecha_factura'); RETURN;
    END IF;
    IF l_fecha > hoy THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'La fecha de la factura no puede ser posterior a hoy',
                'fecha_factura');
        RETURN;
    END IF;

    -- El mes que cubre: del 1 al ultimo dia. No un mes que todavia no empezo.
    IF l_mes IS NULL OR l_mes > 12 OR l_anio IS NULL OR l_anio < c_anio_minimo THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'Elegi el mes que cubre la factura', 'mes'); RETURN;
    END IF;
    l_desde := TO_DATE(l_anio || '-' || l_mes || '-01', 'YYYY-MM-DD');
    l_hasta := LAST_DAY(l_desde);
    IF l_desde > hoy THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'El mes de la factura todavia no empezo', 'mes'); RETURN;
    END IF;

    -- La foto: obligatoria en el alta; en la modificacion, vacia deja la que habia.
    IF l_foto IS NULL AND l_id IS NULL THEN
        ROLLBACK;
        p_error(400, 'Bad Request', 'Subi la foto de la factura', 'foto_url'); RETURN;
    END IF;
    IF l_foto IS NOT NULL THEN
        IF LENGTH(l_foto) > c_largo_foto OR NOT PKG_CLOUDINARY_ETHOS.es_url_propia(l_foto) THEN
            ROLLBACK;
            p_error(400, 'Bad Request', 'La foto no se subio bien: volve a subirla', 'foto_url');
            RETURN;
        END IF;
    END IF;

    -- El mismo numero (con el mismo timbrado) no se repite.
    SELECT COUNT(*) INTO l_n FROM FACTURAS_FACILITADORES
     WHERE ID_FACILITADOR = l_fac
       AND NRO_FACTURA = l_nro
       AND NVL(TIMBRADO, '-') = NVL(l_timbrado, '-')
       AND (l_id IS NULL OR ID_FACTURA <> l_id);
    IF l_n > 0 THEN
        ROLLBACK;
        p_error(409, 'Conflict', 'Ya cargaste la factura ' || l_nro, 'nro_factura'); RETURN;
    END IF;

    -- Una factura por mes: ningun dia en dos facturas (la regla del sitio).
    BEGIN
        SELECT * INTO l_otra FROM FACTURAS_FACILITADORES
         WHERE ID_FACILITADOR = l_fac
           AND FECHA_DESDE <= l_hasta
           AND FECHA_HASTA >= l_desde
           AND (l_id IS NULL OR ID_FACTURA <> l_id)
           AND ROWNUM = 1;
        ROLLBACK;
        p_error(409, 'Conflict', 'Ya hay una factura de ' || nombre_mes(l_mes) || ' ' || l_anio
                || ' (la ' || l_otra.NRO_FACTURA || ')', 'mes');
        RETURN;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN NULL;
    END;

    IF l_id IS NULL THEN
        -- CANTIDAD, SUELDO y MONTO en 0: la completa el administrador.
        INSERT INTO FACTURAS_FACILITADORES (
            ID_FACILITADOR, NRO_FACTURA, TIMBRADO, FECHA_FACTURA, FECHA_DESDE, FECHA_HASTA,
            CANTIDAD, SUELDO, MONTO, FOTO_URL)
        VALUES (
            l_fac, l_nro, l_timbrado, l_fecha, l_desde, l_hasta,
            0, 0, 0, l_foto)
        RETURNING ID_FACTURA INTO l_id;
    ELSE
        -- CANTIDAD = 0 otra vez: si el administrador la reviso en el medio, no
        -- se pisa (SQL%ROWCOUNT = 0).
        UPDATE FACTURAS_FACILITADORES
           SET NRO_FACTURA = l_nro, TIMBRADO = l_timbrado, FECHA_FACTURA = l_fecha,
               FECHA_DESDE = l_desde, FECHA_HASTA = l_hasta,
               FOTO_URL = NVL(l_foto, FOTO_URL)
         WHERE ID_FACTURA = l_id AND ID_FACILITADOR = l_fac AND NVL(CANTIDAD, 0) = 0;
        IF SQL%ROWCOUNT = 0 THEN
            ROLLBACK;
            p_error(409, 'Conflict', 'La factura ya fue revisada: no se puede modificar'); RETURN;
        END IF;
    END IF;
    COMMIT;

    -- Despues del COMMIT: la foto reemplazada se borra de Cloudinary. Si
    -- falla, la factura ya quedo bien: solo se avisa.
    IF l_foto_vieja IS NOT NULL AND l_foto IS NOT NULL AND l_foto <> l_foto_vieja THEN
        l_aviso := limpiar_foto(l_foto_vieja);
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('id_factura', l_id);
    APEX_JSON.WRITE('nro_factura', l_nro);
    APEX_JSON.WRITE('message', CASE WHEN p_id IS NULL THEN 'Factura enviada' ELSE 'Factura actualizada' END);
    IF l_aviso IS NOT NULL THEN
        APEX_JSON.WRITE('aviso', 'La foto anterior no se pudo borrar: ' || l_aviso);
    END IF;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        IF SQLCODE = -1 THEN
            p_error(409, 'Conflict', 'Ese numero de factura ya esta cargado', 'nro_factura');
        ELSIF SQLCODE = -2290 THEN
            p_error(400, 'Bad Request', 'El periodo de la factura no es valido', 'mes');
        ELSE
            p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
        END IF;
END guardar;

/* -------------------------------------------------------------------------- */
/* DELETE mis-facturas/:id                                                    */
/* -------------------------------------------------------------------------- */

PROCEDURE eliminar(p_token IN VARCHAR2, p_id IN VARCHAR2) IS
    l_fac   NUMBER;
    l_id    NUMBER := f_numero(p_id);
    l_n     PLS_INTEGER;
    l_foto  FACTURAS_FACILITADORES.FOTO_URL%TYPE;
    l_aviso VARCHAR2(4000);
BEGIN
    IF NOT contexto(p_token, TRUE, l_fac) THEN RETURN; END IF;
    IF l_id IS NULL THEN
        p_error(400, 'Bad Request', 'Id de factura invalido'); RETURN;
    END IF;

    DELETE FROM FACTURAS_FACILITADORES
     WHERE ID_FACTURA = l_id AND ID_FACILITADOR = l_fac AND NVL(CANTIDAD, 0) = 0
    RETURNING FOTO_URL INTO l_foto;
    IF SQL%ROWCOUNT = 0 THEN
        ROLLBACK;
        SELECT COUNT(*) INTO l_n FROM FACTURAS_FACILITADORES
         WHERE ID_FACTURA = l_id AND ID_FACILITADOR = l_fac;
        IF l_n > 0 THEN
            p_error(409, 'Conflict', 'La factura ya fue revisada: no se puede borrar');
        ELSE
            p_error(404, 'Not Found', 'La factura no existe');
        END IF;
        RETURN;
    END IF;
    COMMIT;

    -- Despues del COMMIT: su foto se borra de Cloudinary. Si falla, solo se avisa.
    l_aviso := limpiar_foto(l_foto);

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', 'Factura eliminada');
    APEX_JSON.WRITE('foto_borrada', l_foto IS NOT NULL AND l_aviso IS NULL);
    IF l_aviso IS NOT NULL THEN
        APEX_JSON.WRITE('aviso', 'La foto no se pudo borrar: ' || l_aviso);
    END IF;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END eliminar;

/* -------------------------------------------------------------------------- */
/* POST mis-facturas/firma-foto                                               */
/* -------------------------------------------------------------------------- */

PROCEDURE firma_foto(p_token IN VARCHAR2) IS
    l_fac   NUMBER;
    l_falta VARCHAR2(400);
BEGIN
    IF NOT contexto(p_token, TRUE, l_fac) THEN RETURN; END IF;
    l_falta := PKG_CLOUDINARY_ETHOS.falta;
    IF l_falta IS NOT NULL THEN
        p_error(503, 'Service Unavailable', 'Todavia no se pueden subir fotos: ' || l_falta);
        RETURN;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    PKG_CLOUDINARY_ETHOS.escribir_firma(c_carpeta_foto);
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END firma_foto;

END PKG_FACTURAS_APP_ETHOS;
/

DECLARE
  l_errores NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_errores FROM USER_ERRORS WHERE NAME = 'PKG_FACTURAS_APP_ETHOS';
  IF l_errores > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[ERROR] PKG_FACTURAS_APP_ETHOS compilo con errores:');
    FOR e IN (SELECT TYPE, LINE, TEXT FROM USER_ERRORS
               WHERE NAME = 'PKG_FACTURAS_APP_ETHOS' ORDER BY TYPE, SEQUENCE) LOOP
      DBMS_OUTPUT.PUT_LINE('        ' || e.TYPE || ' L' || e.LINE || ': ' || e.TEXT);
    END LOOP;
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_FACTURAS_APP_ETHOS compilado.');
  END IF;
END;
/

--------------------------------------------------------------------------------
-- 2. ENDPOINTS (modulo 'ethos' existente: SIN ORDS.DEFINE_MODULE)
--------------------------------------------------------------------------------

DECLARE
  TYPE t_rutas IS TABLE OF VARCHAR2(100);
  l_rutas t_rutas := t_rutas('mis-facturas', 'mis-facturas/firma-foto', 'mis-facturas/:id');
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

  -- La ruta fija (firma-foto) con mas prioridad que la de :id.
  PROCEDURE publicar(p_pattern IN VARCHAR2, p_method IN VARCHAR2, p_llamada IN VARCHAR2,
                     p_priority IN NUMBER DEFAULT 0) IS
    l_existe NUMBER;
  BEGIN
    BEGIN ORDS.DELETE_HANDLER('ethos', p_pattern, p_method); EXCEPTION WHEN OTHERS THEN NULL; END;
    -- La ruta se crea SOLO si no existe. ORDS.DEFINE_TEMPLATE sobre una ruta que ya existe la
    -- REEMPLAZA y borra sus handlers: con GET y POST en mis-facturas, publicar el POST borraba
    -- el GET (y el DELETE de :id borraba el PUT). Paso el 04/11/2026: quedaron 3 de 5.
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
       AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_FACTURAS_APP_ETHOS') = 0;
    IF l_ajenos > 0 THEN
      RAISE_APPLICATION_ERROR(-20000, 'La ruta ethos/' || l_rutas(i) ||
        ' ya existe y no es de este script: no se publico nada para no pisarla.');
    END IF;
  END LOOP;

  publicar('mis-facturas', 'GET',
           'PKG_FACTURAS_APP_ETHOS.MIS_FACTURAS(p_token => l_token);');
  publicar('mis-facturas', 'POST',
           'PKG_FACTURAS_APP_ETHOS.GUARDAR(p_token => l_token, p_id => NULL, p_nro_factura => :nro_factura, p_timbrado => :timbrado, p_fecha_factura => :fecha_factura, p_anio => :anio, p_mes => :mes, p_foto_url => :foto_url);');
  publicar('mis-facturas/firma-foto', 'POST',
           'PKG_FACTURAS_APP_ETHOS.FIRMA_FOTO(p_token => l_token);', 2);
  publicar('mis-facturas/:id', 'PUT',
           'PKG_FACTURAS_APP_ETHOS.GUARDAR(p_token => l_token, p_id => :id, p_nro_factura => :nro_factura, p_timbrado => :timbrado, p_fecha_factura => :fecha_factura, p_anio => :anio, p_mes => :mes, p_foto_url => :foto_url);', 1);
  publicar('mis-facturas/:id', 'DELETE',
           'PKG_FACTURAS_APP_ETHOS.ELIMINAR(p_token => l_token, p_id => :id);', 1);
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 5 endpoints de ethos/mis-facturas.');
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
     AND t.URI_TEMPLATE LIKE 'mis-facturas%'
     AND DBMS_LOB.INSTR(h.SOURCE, 'PKG_FACTURAS_APP_ETHOS') > 0;
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de mis-facturas publicados: ' || l_n || ' de 5.');


  SELECT COUNT(*) INTO l_n FROM USER_PROCEDURES
   WHERE OBJECT_NAME = 'PKG_CLOUDINARY_ETHOS' AND PROCEDURE_NAME = 'BORRAR';
  IF l_n = 0 THEN
    DBMS_OUTPUT.PUT_LINE('[WARN] PKG_CLOUDINARY_ETHOS no tiene BORRAR: las facturas se guardan y '
                         || 'borran igual, pero la foto vieja queda en Cloudinary. Se arregla '
                         || 'corriendo el cloudinary.sql nuevo del sitio.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   PKG_CLOUDINARY_ETHOS.BORRAR encontrado: las fotos reemplazadas se borran.');
  END IF;

  IF PKG_CLOUDINARY_ETHOS.falta IS NULL THEN
    DBMS_OUTPUT.PUT_LINE('[OK]   Cloudinary configurado: los facilitadores pueden subir fotos.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[WARN] ' || PKG_CLOUDINARY_ETHOS.falta
                         || ': mis-facturas/firma-foto respondera 503.');
  END IF;
END;
/
