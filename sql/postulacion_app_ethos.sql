--------------------------------------------------------------------------------
-- Facilitadores (app movil) — "Mi postulacion": el facilitador se postula
-- para el año lectivo
--------------------------------------------------------------------------------
-- Script idempotente: se puede volver a correr.
--
--   0. Verificacion previa
--   1. Estructura: verifica que POSTULANTES_FACILITADORES ya tenga
--      ID_FACILITADOR con su FK e indice (la estructura la definio Jose el
--      23/11/2026 y es la fuente de verdad) y le AGREGA, si faltan, las 7
--      columnas de los documentos (*_URL, 24/11/2026). No cambia ni borra
--      ninguna columna existente.
--   2. Paquete PKG_POSTULACION_APP_ETHOS
--   3. Endpoints EXCLUSIVOS en el modulo ORDS 'ethos' (YA EXISTENTE, NO se redefine):
--        GET  mi-postulacion
--        POST mi-postulacion
--        DELETE mi-postulacion          (elimina la suya del año, para cargarla de nuevo)
--        PUT    mi-postulacion/borrador (guarda sin terminar, sin validar)
--        DELETE mi-postulacion/borrador (descarta lo guardado sin terminar)
--        GET  mi-postulacion/lugares
--        POST mi-postulacion/firma-documento
--        DELETE mi-postulacion/documento?url=
--      No pisa nada: si alguna ruta ya existe y NO es de este paquete, se detiene.
--   4. Verificacion
--
-- REQUISITO: PKG_CLOUDINARY_ETHOS (backend/cloudinary.sql del sitio), el mismo
-- de Mis facturas, con la clave, el secreto y el cloud ya cargados.
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
--   USUARIO          (agregada por este script, 24/11/2026) El login de quien
--                    la cargo desde la app. NULL en las del JV26.
--                    Indice unico UX_POSTULANTES_FAC_USUARIO_ANIO
--                    (USUARIO, ID_ANIO), solo de las filas con USUARIO.
--
-- Desde la app se puede postular CUALQUIER usuario con sesion, sea o no
-- facilitador (Jose, 24/11/2026). El servidor pone SIEMPRE, a partir del
-- token, USUARIO y, si es facilitador, ID_FACILITADOR (FACILITADORES.USUARIO =
-- usuario del token); nunca el cliente. Cada uno solo ve y carga SU
-- postulacion: la de su ID_FACILITADOR o la de su USUARIO.
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
-- - UNA postulacion por usuario y año: si ya existe, el POST la CORRIGE en vez
--   de crear otra. Un alta doble a la vez la frena el indice unico (409).
-- - Se puede cargar, corregir, guardar sin terminar, subir documentos y
--   eliminar SOLO mientras el periodo de postulacion este abierto:
--   FN_POSTULACION_ABIERTA(ID_ANIO) = 'SI' (PERIODOS_POSTULACION, Jose
--   24/11/2026). Cerrado, el GET la sigue mostrando (solo lectura) y todo lo
--   que escribe responde 409.
-- - Se puede corregir despues de enviarla, mientras el periodo este abierto.
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
-- DOCUMENTOS (Jose, 24/11/2026)
--------------------------------------------------------------------------------
--
-- El facilitador sube sus documentos (foto o PDF) al postularse, OBLIGATORIOS:
--
--   FOTO_URL               foto tipo carnet (solo foto)          siempre
--   CEDULA_FRENTE_URL      cedula, frente                        siempre
--   CEDULA_DORSO_URL       cedula, dorso                         siempre
--   SECUNDARIO_DOC_URL     titulo de bachiller                   si CONCLUIDO
--   TECNICO_DOC_URL        titulo (concluido) o constancia (cursando)
--   LICENCIATURA_DOC_URL   titulo (concluida) o constancia (cursando)
--   POSGRADO_DOC_URL       titulo (concluido) o constancia (cursando)
--   CV_ARCHIVO                       curriculum (CV)             siempre
--   CERTIFICADO_NO_AGRESOR_ARCHIVO   no agresor sexual de NNA    siempre
--   ANTECEDENTE_JUDICIAL_ARCHIVO     Poder Judicial              siempre
--   ANTECEDENTE_POLICIAL_ARCHIVO     Policia                     siempre
--   (estas 4 las creo Jose; el script solo verifica que existan)
--
-- Con NO / INCONCLUSO / INCONCLUSA el documento de ese nivel queda NULL.
--
-- La app sube cada archivo DIRECTO a Cloudinary con la firma de
-- POST mi-postulacion/firma-documento (preset Signed 'fcfacilitadores',
-- carpeta 'postulaciones-facilitadores') y manda su secure_url. El secreto
-- queda en Oracle (CLOUDINARY_CONFIG): la firma la arma este paquete con la
-- misma clave, secreto y cloud que usa PKG_CLOUDINARY_ETHOS para las
-- facturas, pero con el preset de las postulaciones. El POST solo acepta
-- enlaces de nuestro cloud (PKG_CLOUDINARY_ETHOS.es_url_propia).
--
-- Borrado (Jose, 24/11/2026: "si el usuario elimina una foto se debe eliminar
-- tambien de Cloudinary"):
--   - Al firmar, el servidor elige el nombre del archivo (public_id al azar) y
--     lo anota a nombre del usuario en POSTULANTES_FAC_ARCHIVOS (tabla solo
--     de la app). Solo ese usuario puede borrarlo.
--   - Quitar o reemplazar un documento en la app -> DELETE
--     mi-postulacion/documento?url=: se borra enseguida si ninguna postulacion
--     guardada lo usa. Si lo usa, se borra al guardar la correccion.
--   - Al corregir y reemplazar un documento, despues del COMMIT se borra de
--     Cloudinary el anterior, salvo que lo use otra postulacion (la de otro
--     año, si la precargo).
--   - Si PKG_CLOUDINARY_ETHOS no tiene BORRAR, el archivo queda en Cloudinary
--     y todo lo demas funciona igual.
--
--------------------------------------------------------------------------------
-- CONTRATO
--------------------------------------------------------------------------------
--
--   GET  mi-postulacion
--        { success, es_facilitador, anio, abierta,
--          proceso: ANIOS_LECTIVOS.PROCESO_POSTULACION del año abierto (o null),
--          facilitador: { nombre, telefono, fecha_nacimiento },
--          postulacion: { ...la del año abierto }     (si ya la envio)
--          anterior:    { ...la mas reciente de otro año } (para precargar) }
--        Cada postulacion: { id, anio, fecha_registro ('YYYY-MM-DDTHH:MI'),
--          las columnas de la tabla en minuscula (fecha_nacimiento 'YYYY-MM-DD',
--          dias_disponibles como arreglo, los documentos como foto_url,
--          cedula_frente_url...), departamento, ciudad }.
--
--   POST mi-postulacion   (JSON con las mismas claves; dias_disponibles arreglo)
--        200 { success, id, nueva, message }
--        400 { success:false, message, campo }
--        409 no hay año lectivo abierto, o un alta doble a la vez
--
--   POST mi-postulacion/firma-documento   (sin cuerpo)
--        200 { success, cloud_name, upload_url,
--              campos: { api_key, public_id, timestamp, upload_preset, asset_folder, signature } }
--        409 no hay año lectivo abierto · 503 Cloudinary sin configurar
--
--   DELETE mi-postulacion/documento?url=   (sin cuerpo)
--        200 { success, borrado, en_uso?, aviso? }
--        400 enlace no valido · 404 no es un archivo firmado para este usuario
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
            UNION ALL SELECT 'PKG_AUTH_ETHOS', 'PACKAGE BODY' FROM dual
            UNION ALL SELECT 'PKG_CLOUDINARY_ETHOS', 'PACKAGE BODY' FROM dual
            UNION ALL SELECT 'PERIODOS_POSTULACION', 'TABLE' FROM dual
            UNION ALL SELECT 'FN_POSTULACION_ABIERTA', 'FUNCTION' FROM dual) LOOP
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
-- 1. ESTRUCTURA (verifica; solo agrega las columnas de documentos si faltan)
--------------------------------------------------------------------------------

DECLARE
  l_n PLS_INTEGER;
  PROCEDURE agregar(p_columna IN VARCHAR2, p_comentario IN VARCHAR2,
                    p_tipo IN VARCHAR2 DEFAULT 'VARCHAR2(500 CHAR)') IS
    l_n PLS_INTEGER;
  BEGIN
    SELECT COUNT(*) INTO l_n FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' AND COLUMN_NAME = p_columna;
    IF l_n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE POSTULANTES_FACILITADORES ADD (' || p_columna || ' ' || p_tipo || ')';
      DBMS_OUTPUT.PUT_LINE('[OK]   Columna ' || p_columna || ' agregada.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[OK]   Columna ' || p_columna || ' ya existia.');
    END IF;
    EXECUTE IMMEDIATE 'COMMENT ON COLUMN POSTULANTES_FACILITADORES.' || p_columna
                      || ' IS ''' || REPLACE(p_comentario, '''', '''''') || '''';
  END agregar;
BEGIN
  agregar('FOTO_URL',             'Enlace (Cloudinary) de la foto tipo carnet del postulante.');
  agregar('CEDULA_FRENTE_URL',    'Enlace (Cloudinary) de la foto o PDF del frente de la cédula.');
  agregar('CEDULA_DORSO_URL',     'Enlace (Cloudinary) de la foto o PDF del dorso de la cédula.');
  agregar('SECUNDARIO_DOC_URL',   'Enlace (Cloudinary) del título de bachiller, si la secundaria está concluida.');
  agregar('TECNICO_DOC_URL',      'Enlace (Cloudinary) del título (concluido) o la constancia de estudios (cursando) del técnico superior.');
  agregar('LICENCIATURA_DOC_URL', 'Enlace (Cloudinary) del título (concluida) o la constancia de estudios (cursando) de la licenciatura.');
  agregar('POSGRADO_DOC_URL',     'Enlace (Cloudinary) del título (concluido) o la constancia de estudios (cursando) del posgrado.');

  -- El proceso de postulacion de cada año (lo agrego Jose, 24/11/2026). Solo se verifica.
  SELECT COUNT(*) INTO l_n FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'ANIOS_LECTIVOS' AND COLUMN_NAME = 'PROCESO_POSTULACION';
  DBMS_OUTPUT.PUT_LINE(CASE WHEN l_n > 0 THEN '[OK]   ' ELSE '[ERROR] Falta ' END
                       || 'columna ANIOS_LECTIVOS.PROCESO_POSTULACION');

  -- Documentos que agrego Jose (24/11/2026). El script NO los crea: solo verifica.
  FOR c IN (SELECT COLUMN_VALUE AS col FROM TABLE(SYS.ODCIVARCHAR2LIST(
              'CV_ARCHIVO', 'CERTIFICADO_NO_AGRESOR_ARCHIVO',
              'ANTECEDENTE_JUDICIAL_ARCHIVO', 'ANTECEDENTE_POLICIAL_ARCHIVO'))) LOOP
    SELECT COUNT(*) INTO l_n FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' AND COLUMN_NAME = c.col;
    DBMS_OUTPUT.PUT_LINE(CASE WHEN l_n > 0 THEN '[OK]   ' ELSE '[ERROR] Falta ' END
                         || 'columna POSTULANTES_FACILITADORES.' || c.col);
  END LOOP;

  -- Quien la cargo desde la app (sea o no facilitador). NULL en las del JV26.
  agregar('USUARIO', 'Usuario (login, en mayúsculas) que cargó la postulación desde la app facilitadores. Identifica a los postulantes que no son facilitadores. Nulo en las del formulario JV26.',
          'VARCHAR2(255 CHAR)');

  -- Una por usuario y año. Las filas sin USUARIO (JV26) no entran en el indice.
  SELECT COUNT(*) INTO l_n FROM USER_INDEXES WHERE INDEX_NAME = 'UX_POSTULANTES_FAC_USUARIO_ANIO';
  IF l_n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UX_POSTULANTES_FAC_USUARIO_ANIO ON POSTULANTES_FACILITADORES '
                      || '(CASE WHEN USUARIO IS NOT NULL THEN USUARIO END, '
                      || ' CASE WHEN USUARIO IS NOT NULL THEN ID_ANIO END)';
    DBMS_OUTPUT.PUT_LINE('[OK]   Indice UX_POSTULANTES_FAC_USUARIO_ANIO creado (una por usuario y año).');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   Indice UX_POSTULANTES_FAC_USUARIO_ANIO ya existia.');
  END IF;

  -- Tabla SOLO de la app: los nombres (public_id) de Cloudinary que el servidor
  -- le dio a cada usuario al firmar una subida. Solo se puede borrar un archivo
  -- anotado a nombre de quien lo pide.
  SELECT COUNT(*) INTO l_n FROM USER_TABLES WHERE TABLE_NAME = 'POSTULANTES_FAC_ARCHIVOS';
  IF l_n = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE POSTULANTES_FAC_ARCHIVOS (
        ID         NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY,
        USUARIO    VARCHAR2(255 CHAR) NOT NULL,
        PUBLIC_ID  VARCHAR2(200 CHAR) NOT NULL,
        FECHA      DATE DEFAULT SYSDATE NOT NULL,
        CONSTRAINT UX_POSTULANTES_FAC_ARCH_PID UNIQUE (PUBLIC_ID)
      )]';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_POSTULANTES_FAC_ARCH_USU ON POSTULANTES_FAC_ARCHIVOS (USUARIO)';
    EXECUTE IMMEDIATE q'[COMMENT ON TABLE POSTULANTES_FAC_ARCHIVOS IS 'App facilitadores: documentos de postulación subidos a Cloudinary (public_id) y el usuario que los subió. Solo ese usuario puede borrarlos desde la app.']';
    DBMS_OUTPUT.PUT_LINE('[OK]   Tabla POSTULANTES_FAC_ARCHIVOS creada.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   Tabla POSTULANTES_FAC_ARCHIVOS ya existia.');
  END IF;

  -- Tabla SOLO de la app: la postulacion guardada SIN TERMINAR (ningun campo es
  -- obligatorio para guardar; Jose, 24/11/2026). Una por usuario y año, con lo
  -- cargado como JSON. Al enviarla completa pasa a POSTULANTES_FACILITADORES y
  -- el borrador se borra. Asi la tabla del JV26 no recibe filas incompletas.
  SELECT COUNT(*) INTO l_n FROM USER_TABLES WHERE TABLE_NAME = 'POSTULANTES_FAC_BORRADORES';
  IF l_n = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE POSTULANTES_FAC_BORRADORES (
        ID             NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY,
        USUARIO        VARCHAR2(255 CHAR) NOT NULL,
        ID_ANIO        NUMBER NOT NULL,
        ID_FACILITADOR NUMBER,
        DATOS          CLOB NOT NULL,
        PASO           NUMBER(3),
        FECHA          DATE DEFAULT SYSDATE NOT NULL,
        CONSTRAINT UX_POSTULANTES_FAC_BORR UNIQUE (USUARIO, ID_ANIO),
        CONSTRAINT CK_POSTULANTES_FAC_BORR_JSON CHECK (DATOS IS JSON)
      )]';
    EXECUTE IMMEDIATE q'[COMMENT ON TABLE POSTULANTES_FAC_BORRADORES IS 'App facilitadores: postulación guardada sin terminar (JSON con los datos del formulario), una por usuario y año. Al enviarla completa pasa a POSTULANTES_FACILITADORES.']';
    DBMS_OUTPUT.PUT_LINE('[OK]   Tabla POSTULANTES_FAC_BORRADORES creada.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   Tabla POSTULANTES_FAC_BORRADORES ya existia.');
  END IF;
END;
/

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

-- ESTADO acepta tambien INCOMPLETO: la postulacion guardada sin terminar, que los
-- administradores ya ven (Jose, 24/11/2026). La CHECK original de la tabla
-- (PENDIENTE, APROBADA, RECHAZADA) tiene nombre de sistema (SYS_C...): se busca
-- por su condicion, se borra y se crea CK_POSTULANTES_FAC_ESTADO con los cuatro.
-- Si ya existe, no se toca. Las filas actuales cumplen la nueva (es mas amplia).
DECLARE
  l_n PLS_INTEGER;
BEGIN
  SELECT COUNT(*) INTO l_n FROM USER_CONSTRAINTS
   WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' AND CONSTRAINT_NAME = 'CK_POSTULANTES_FAC_ESTADO';
  IF l_n > 0 THEN
    DBMS_OUTPUT.PUT_LINE('[OK]   CK_POSTULANTES_FAC_ESTADO ya existia: ESTADO acepta INCOMPLETO.');
  ELSE
    -- "estado IN (...)" y no "estado_civil IN (...)": la condicion empieza con la columna.
    FOR c IN (SELECT CONSTRAINT_NAME, SEARCH_CONDITION_VC AS cond FROM USER_CONSTRAINTS
               WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' AND CONSTRAINT_TYPE = 'C') LOOP
      IF REGEXP_LIKE(c.cond, '^[[:space:]]*"?estado"?[[:space:]]+in[[:space:]]*\(', 'i') THEN
        EXECUTE IMMEDIATE 'ALTER TABLE POSTULANTES_FACILITADORES DROP CONSTRAINT "' || c.CONSTRAINT_NAME || '"';
        DBMS_OUTPUT.PUT_LINE('[OK]   CHECK anterior de ESTADO borrada (' || c.CONSTRAINT_NAME || '): ' || c.cond);
      END IF;
    END LOOP;
    EXECUTE IMMEDIATE q'[ALTER TABLE POSTULANTES_FACILITADORES ADD CONSTRAINT CK_POSTULANTES_FAC_ESTADO
                         CHECK (ESTADO IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'INCOMPLETO'))]';
    DBMS_OUTPUT.PUT_LINE('[OK]   CK_POSTULANTES_FAC_ESTADO creada: ESTADO acepta PENDIENTE, APROBADA, RECHAZADA e INCOMPLETO.');
  END IF;
  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN POSTULANTES_FACILITADORES.ESTADO IS 'Estado de la postulación: INCOMPLETO (guardada sin terminar desde la app facilitadores, todavía no enviada), PENDIENTE (enviada, por revisar), APROBADA o RECHAZADA (revisión del administrador).']';
END;
/

-- NOMBRE_COMPLETO y CEDULA dejan de ser NOT NULL (Jose, 24/11/2026): la
-- postulacion guardada sin terminar (INCOMPLETO) aparece para los
-- administradores aunque todavia no tenga esos datos. Para ENVIARLA siguen
-- siendo obligatorios: lo valida el paquete (leer_formulario en modo estricto).
-- Solo se cambia si hoy son NOT NULL; correrlo de nuevo no hace nada.
DECLARE
  l_nullable VARCHAR2(1);
BEGIN
  FOR c IN (SELECT COLUMN_VALUE AS col FROM TABLE(SYS.ODCIVARCHAR2LIST('NOMBRE_COMPLETO', 'CEDULA'))) LOOP
    SELECT MAX(NULLABLE) INTO l_nullable FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' AND COLUMN_NAME = c.col;
    IF l_nullable IS NULL THEN
      DBMS_OUTPUT.PUT_LINE('[ERROR] Falta la columna POSTULANTES_FACILITADORES.' || c.col);
    ELSIF l_nullable = 'N' THEN
      EXECUTE IMMEDIATE 'ALTER TABLE POSTULANTES_FACILITADORES MODIFY (' || c.col || ' NULL)';
      DBMS_OUTPUT.PUT_LINE('[OK]   ' || c.col || ' ahora acepta vacio (guardar sin terminar). Para enviar sigue siendo obligatoria.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[OK]   ' || c.col || ' ya aceptaba vacio.');
    END IF;
  END LOOP;
END;
/

-- Columnas que la app NO escribe (ESTADO y las del administrador): en el alta
-- toman su DEFAULT. Si alguna es NOT NULL y no tiene DEFAULT, el envio falla con
-- ORA-01400: aca se avisa antes. DATA_DEFAULT es LONG, por eso se lee en PL/SQL.
DECLARE
  -- Las que escribe guardar() del paquete (mantener igual que su INSERT).
  c_app CONSTANT VARCHAR2(4000) := ',ID,ESTADO,ID_FACILITADOR,USUARIO,ID_ANIO,FECHA_REGISTRO,ACEPTA_PROCESO,'
    || 'NOMBRE_COMPLETO,CEDULA,FECHA_NACIMIENTO,EDAD,NACIONALIDAD,TELEFONO,CORREO_ELECTRONICO,'
    || 'ESTADO_CIVIL,ESTADO_CIVIL_OTRO,VIVE_CON,HIJOS,TALLE_REMERA,ID_PAIS,ID_DEPARTAMENTO,ID_CIUDAD,'
    || 'DIRECCION,UBICACION_DOMICILIO,SECUNDARIO_ESTADO,SECUNDARIO_TITULO,TECNICO_ESTADO,TECNICO_TITULO,'
    || 'TECNICO_ANIO,LICENCIATURA_ESTADO,LICENCIATURA_TITULO,LICENCIATURA_ANIO,POSGRADO_ESTADO,'
    || 'POSGRADO_TITULO,POSGRADO_ANIO,ACTIVIDAD_LABORAL,EMPRESA,CARGO,MOVILIDAD_PROPIA,TIPO_VEHICULO,'
    || 'COMPUTADORA_PROPIA,INTERNET_ESTABLE,MANEJO_OFFICE,DIAS_DISPONIBLES,TURNO,IGLESIA_DENOMINACION,'
    || 'IGLESIA_NOMBRE,PASTOR_NOMBRE,PASTOR_TELEFONO,LIDER_NOMBRE,LIDER_TELEFONO,BAUTIZADO_AGUA,'
    || 'AREAS_MINISTERIO,BANCO_NOMBRE,BANCO_SUCURSAL,TITULAR_NOMBRE,TITULAR_CI,TIPO_CUENTA,'
    || 'NUMERO_CUENTA,FACTURA_TIPO,FACTURA_EMISOR,RUC,FOTO_URL,CEDULA_FRENTE_URL,CEDULA_DORSO_URL,'
    || 'SECUNDARIO_DOC_URL,TECNICO_DOC_URL,LICENCIATURA_DOC_URL,POSGRADO_DOC_URL,CV_ARCHIVO,'
    || 'CERTIFICADO_NO_AGRESOR_ARCHIVO,ANTECEDENTE_JUDICIAL_ARCHIVO,ANTECEDENTE_POLICIAL_ARCHIVO,';
  l_def VARCHAR2(32767);
BEGIN
  FOR c IN (SELECT COLUMN_NAME, NULLABLE, DATA_DEFAULT FROM USER_TAB_COLUMNS
             WHERE TABLE_NAME = 'POSTULANTES_FACILITADORES' ORDER BY COLUMN_ID) LOOP
    IF INSTR(c_app, ',' || c.COLUMN_NAME || ',') = 0 THEN
      l_def := TRIM(c.DATA_DEFAULT);
      IF c.NULLABLE = 'N' AND l_def IS NULL THEN
        DBMS_OUTPUT.PUT_LINE('[ERROR] ' || c.COLUMN_NAME || ' es NOT NULL y no tiene DEFAULT: '
                             || 'enviar una postulacion nueva falla (ORA-01400). Darle un DEFAULT '
                             || 'o decir con que valor arranca.');
      ELSE
        DBMS_OUTPUT.PUT_LINE('[OK]   ' || c.COLUMN_NAME || ': la app no la escribe; en el alta toma '
                             || NVL(l_def, 'NULL') || '.');
      END IF;
    ELSIF c.NULLABLE = 'N'
          AND c.COLUMN_NAME NOT IN ('ID', 'ESTADO', 'ID_ANIO', 'USUARIO', 'FECHA_REGISTRO', 'ACEPTA_PROCESO') THEN
      -- Del formulario y obligatoria en la tabla (el bloque anterior ya les saco
      -- el NOT NULL a NOMBRE_COMPLETO y CEDULA): guardar sin terminar falla
      -- mientras falte ese dato.
      DBMS_OUTPUT.PUT_LINE('[WARN] ' || c.COLUMN_NAME || ' es NOT NULL: guardar sin terminar falla '
                           || 'mientras falte ese dato (sacarle el NOT NULL como a NOMBRE_COMPLETO y CEDULA).');
    END IF;
  END LOOP;
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

  -- Firma para subir un documento a Cloudinary (preset fcfacilitadores).
  PROCEDURE firma_documento(p_token IN VARCHAR2);

  -- Borra de Cloudinary un documento que el usuario quito o reemplazo.
  PROCEDURE quitar_documento(p_token IN VARCHAR2, p_url IN VARCHAR2);

  -- Elimina SU postulacion del año abierto (y sus documentos de Cloudinary).
  PROCEDURE eliminar(p_token IN VARCHAR2);

  -- Guarda SIN TERMINAR (sin validar): { paso, datos: '<JSON del formulario>' }.
  PROCEDURE guardar_borrador(p_token IN VARCHAR2, p_body IN CLOB);

  -- Descarta lo guardado sin terminar (y sus documentos de Cloudinary).
  PROCEDURE descartar_borrador(p_token IN VARCHAR2);

END PKG_POSTULACION_APP_ETHOS;
/

CREATE OR REPLACE PACKAGE BODY PKG_POSTULACION_APP_ETHOS AS

-- Constantes, excepciones y variables antes que cualquier procedimiento del body.
c_pais_defecto CONSTANT NUMBER       := 1;
c_dias         CONSTANT VARCHAR2(60) := 'LUNES,MARTES,MIERCOLES,JUEVES,VIERNES';
c_edad_minima  CONSTANT PLS_INTEGER  := 16;
c_edad_maxima  CONSTANT PLS_INTEGER  := 99;
c_largo_areas  CONSTANT PLS_INTEGER  := 4000;
c_largo_url    CONSTANT PLS_INTEGER  := 500;
-- ESTADO con el que entra una postulacion enviada desde la app (Jose, 24/11/2026).
-- Despues lo cambia el administrador; una correccion no se lo pisa.
c_estado_inicial CONSTANT VARCHAR2(30) := 'PENDIENTE';
-- ESTADO de la guardada SIN TERMINAR (Guardar / Guardar y terminar despues), para
-- que los administradores ya vean lo cargado (Jose, 24/11/2026). Al enviarla pasa
-- a PENDIENTE. La app la sigue mostrando como "sin enviar".
c_estado_borrador CONSTANT VARCHAR2(30) := 'INCOMPLETO';
-- Cloudinary: preset Signed de las postulaciones y su carpeta.
c_preset_docs  CONSTANT VARCHAR2(60) := 'fcfacilitadores';
c_carpeta_docs CONSTANT VARCHAR2(60) := 'postulaciones-facilitadores';

-- Nombres posibles del secreto en CLOUDINARY_CONFIG (PKG_CLOUDINARY_ETHOS.config).
TYPE t_claves IS TABLE OF VARCHAR2(30);
c_claves_secreto CONSTANT t_claves := t_claves('api_secret', 'API_SECRET', 'secreto', 'SECRETO', 'secret', 'SECRET');
-- Las claves de los documentos en el JSON del formulario (borrador).
c_claves_doc CONSTANT t_claves := t_claves(
    'foto_url', 'cedula_frente_url', 'cedula_dorso_url', 'secundario_doc_url', 'tecnico_doc_url',
    'licenciatura_doc_url', 'posgrado_doc_url', 'cv_archivo', 'certificado_no_agresor_archivo',
    'antecedente_judicial_archivo', 'antecedente_policial_archivo');
c_largo_borrador CONSTANT PLS_INTEGER := 200000;

-- Un dato invalido: falla() deja el campo y el mensaje y la lanza.
e_dato    EXCEPTION;
g_campo   VARCHAR2(60);
g_mensaje VARCHAR2(400);
-- Modo suave (guardar sin terminar): falla() no corta y el dato queda NULL. Cada
-- procedimiento que lo usa lo vuelve a FALSE, tambien si falla: la sesion de ORDS
-- se reutiliza y un TRUE olvidado dejaria enviar una postulacion sin validar.
g_suave   BOOLEAN := FALSE;

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

-- Como p_error, pero con HTP.P directo: para cuando la salida de APEX_JSON
-- se uso hacia un CLOB (firma_documento).
PROCEDURE error_htp(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2) IS
BEGIN
    OWA_UTIL.STATUS_LINE(p_status, p_reason, FALSE);
    abrir_json;
    HTP.P('{"success":false,"message":' || APEX_JSON.STRINGIFY(p_message) || '}');
END error_htp;

PROCEDURE falla(p_campo IN VARCHAR2, p_mensaje IN VARCHAR2) IS
BEGIN
    IF g_suave THEN RETURN; END IF;
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
-- Contexto del token: su usuario (o_usuario, en mayusculas) y su
-- ID_FACILITADOR (NULL si no es facilitador: igual se puede postular).
-- Escribe el error y devuelve FALSE si el token no sirve (401).
------------------------------------------------------------------------------
FUNCTION contexto(p_token IN VARCHAR2, o_usuario OUT VARCHAR2,
                  o_id_facilitador OUT NUMBER) RETURN BOOLEAN IS
BEGIN
    o_usuario := UPPER(TRIM(PKG_AUTH_ETHOS.validar_token(p_token)));
    IF o_usuario IS NULL THEN
        p_error(401, 'Unauthorized', 'Token invalido o expirado');
        RETURN FALSE;
    END IF;
    BEGIN
        SELECT ID_FACILITADOR INTO o_id_facilitador FROM FACILITADORES
         WHERE UPPER(TRIM(USUARIO)) = o_usuario;
    EXCEPTION
        WHEN OTHERS THEN o_id_facilitador := NULL;
    END;
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
        RETURN NULL; -- solo en modo suave
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
        RETURN NULL; -- solo en modo suave
    END IF;
    RETURN l_v;
END opcion;

FUNCTION telefono(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767) := texto(p_campo, p_etiqueta, 30);
BEGIN
    IF NOT REGEXP_LIKE(l_v, '^\+?[0-9 ()-]{6,}$') THEN
        falla(p_campo, p_etiqueta || ': solo numeros, espacios, guiones o +');
        RETURN NULL; -- solo en modo suave
    END IF;
    RETURN l_v;
END telefono;

-- Cedula paraguaya: solo numeros (se sacan puntos, espacios y guiones).
FUNCTION cedula(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767) := REGEXP_REPLACE(texto(p_campo, p_etiqueta, 20), '[. -]', '');
BEGIN
    IF NOT REGEXP_LIKE(l_v, '^[0-9]{3,15}$') THEN
        falla(p_campo, p_etiqueta || ': solo numeros');
        RETURN NULL; -- solo en modo suave
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
            o_anio := NULL; -- solo en modo suave
        END IF;
    END IF;
END estudio;

-- Enlace de un documento subido a Cloudinary. NULL si no corresponde pedirlo;
-- si corresponde, es obligatorio y tiene que ser de nuestro cloud.
FUNCTION documento(p_campo IN VARCHAR2, p_etiqueta IN VARCHAR2, p_requerido IN BOOLEAN) RETURN VARCHAR2 IS
    l_v VARCHAR2(32767);
BEGIN
    IF NOT p_requerido THEN RETURN NULL; END IF;
    l_v := TRIM(APEX_JSON.GET_VARCHAR2(p_path => p_campo));
    IF l_v IS NULL THEN
        falla(p_campo, 'Falta subir: ' || p_etiqueta);
        RETURN NULL; -- solo en modo suave
    END IF;
    IF LENGTH(l_v) > c_largo_url OR NOT PKG_CLOUDINARY_ETHOS.es_url_propia(l_v) THEN
        falla(p_campo, p_etiqueta || ': el archivo no es valido, volve a subirlo');
        RETURN NULL; -- solo en modo suave
    END IF;
    RETURN l_v;
END documento;

-- Concluido o cursando: se pide el titulo o la constancia de ese nivel.
-- Si se puede cargar y modificar la postulacion de ese año: lo decide
-- FN_POSTULACION_ABIERTA (PERIODOS_POSTULACION: rango de fechas o habilitacion
-- extraordinaria; Jose, 24/11/2026). Sin periodo cargado, cerrada.
FUNCTION periodo_abierto(p_id_anio IN NUMBER) RETURN BOOLEAN IS
BEGIN
    RETURN p_id_anio IS NOT NULL AND NVL(FN_POSTULACION_ABIERTA(p_id_anio), 'NO') = 'SI';
EXCEPTION
    WHEN OTHERS THEN RETURN FALSE;
END periodo_abierto;

FUNCTION pide_doc(p_estado IN VARCHAR2) RETURN BOOLEAN IS
BEGIN
    RETURN p_estado IN ('CONCLUIDO', 'CONCLUIDA', 'CURSANDO');
END pide_doc;

/* -------------------------------------------------------------------------- */
/* Cloudinary                                                                 */
/* -------------------------------------------------------------------------- */

-- El secreto de CLOUDINARY_CONFIG, o NULL si no se encuentra con ningun nombre.
FUNCTION secreto RETURN VARCHAR2 IS
    l_v VARCHAR2(4000);
BEGIN
    FOR i IN 1 .. c_claves_secreto.COUNT LOOP
        l_v := PKG_CLOUDINARY_ETHOS.config(c_claves_secreto(i));
        IF l_v IS NOT NULL THEN RETURN l_v; END IF;
    END LOOP;
    RETURN NULL;
END secreto;

-- Borra de Cloudinary un documento reemplazado, si ya no lo usa ninguna
-- postulacion. Nunca lanza: se llama despues del COMMIT. La llamada es
-- dinamica para que el paquete compile aunque PKG_CLOUDINARY_ETHOS no tenga
-- BORRAR (la version vieja del sitio); en ese caso el archivo queda.
-- Si alguna postulacion (de quien sea) usa ese enlace.
FUNCTION en_uso(p_url IN VARCHAR2) RETURN BOOLEAN IS
    l_n PLS_INTEGER;
BEGIN
    SELECT COUNT(*) INTO l_n FROM POSTULANTES_FACILITADORES
     WHERE p_url IN (FOTO_URL, CEDULA_FRENTE_URL, CEDULA_DORSO_URL, SECUNDARIO_DOC_URL,
                     TECNICO_DOC_URL, LICENCIATURA_DOC_URL, POSGRADO_DOC_URL,
                     CV_ARCHIVO, CERTIFICADO_NO_AGRESOR_ARCHIVO,
                     ANTECEDENTE_JUDICIAL_ARCHIVO, ANTECEDENTE_POLICIAL_ARCHIVO);
    RETURN l_n > 0;
END en_uso;

-- PKG_CLOUDINARY_ETHOS.borrar: NULL si quedo borrado; si no, el motivo. La
-- llamada es dinamica para que el paquete compile aunque no exista BORRAR
-- (la version vieja del sitio). Nunca lanza. Si se borro, saca su registro
-- de POSTULANTES_FAC_ARCHIVOS.
FUNCTION borrar_archivo(p_url IN VARCHAR2) RETURN VARCHAR2 IS
    l_r VARCHAR2(4000);
BEGIN
    BEGIN
        EXECUTE IMMEDIATE 'BEGIN :r := PKG_CLOUDINARY_ETHOS.borrar(:u); END;' USING OUT l_r, IN p_url;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'PKG_CLOUDINARY_ETHOS no tiene BORRAR (falta correr el cloudinary.sql nuevo del sitio)';
    END;
    IF l_r IS NULL THEN
        DELETE FROM POSTULANTES_FAC_ARCHIVOS
         WHERE INSTR(p_url, '/' || PUBLIC_ID || '.') > 0;
        COMMIT;
    END IF;
    RETURN l_r;
EXCEPTION
    WHEN OTHERS THEN RETURN SQLERRM;
END borrar_archivo;

-- Borra de Cloudinary un documento reemplazado, si ya no lo usa ninguna
-- postulacion. Nunca lanza: se llama despues del COMMIT. Sin BORRAR en
-- PKG_CLOUDINARY_ETHOS el archivo queda.
PROCEDURE limpiar(p_url IN VARCHAR2) IS
    l_r VARCHAR2(4000);
BEGIN
    IF p_url IS NULL OR en_uso(p_url) THEN RETURN; END IF;
    l_r := borrar_archivo(p_url);
EXCEPTION
    WHEN OTHERS THEN NULL;
END limpiar;

-- Borra de Cloudinary los documentos de un borrador descartado que ninguna
-- postulacion guardada use. Nunca lanza.
PROCEDURE limpiar_borrador(p_datos IN CLOB) IS
    l_vals APEX_JSON.T_VALUES;
BEGIN
    IF p_datos IS NULL THEN RETURN; END IF;
    APEX_JSON.PARSE(p_values => l_vals, p_source => p_datos);
    FOR i IN 1 .. c_claves_doc.COUNT LOOP
        limpiar(TRIM(APEX_JSON.GET_VARCHAR2(p_path => c_claves_doc(i), p_values => l_vals)));
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN NULL;
END limpiar_borrador;

/* -------------------------------------------------------------------------- */
/* GET mi-postulacion                                                         */
/* -------------------------------------------------------------------------- */

-- FACILITADORES."DENOMINACIÓN" lleva tilde en el nombre de la columna: se busca en el
-- diccionario y se lee con SQL dinamico, asi el script no depende de como se guarde la
-- tilde al subirlo. NULL si no esta o falla.
FUNCTION denominacion(p_fac IN NUMBER) RETURN VARCHAR2 IS
    l_col VARCHAR2(128);
    l_v   VARCHAR2(4000);
BEGIN
    IF p_fac IS NULL THEN RETURN NULL; END IF;
    SELECT MIN(COLUMN_NAME) INTO l_col FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'FACILITADORES' AND COLUMN_NAME LIKE 'DENOMINACI%';
    IF l_col IS NULL THEN RETURN NULL; END IF;
    EXECUTE IMMEDIATE 'SELECT "' || l_col || '" FROM FACILITADORES WHERE ID_FACILITADOR = :1'
       INTO l_v USING p_fac;
    RETURN l_v;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END denominacion;

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
    w('foto_url', p.FOTO_URL);
    w('cedula_frente_url', p.CEDULA_FRENTE_URL);
    w('cedula_dorso_url', p.CEDULA_DORSO_URL);
    w('secundario_doc_url', p.SECUNDARIO_DOC_URL);
    w('tecnico_doc_url', p.TECNICO_DOC_URL);
    w('licenciatura_doc_url', p.LICENCIATURA_DOC_URL);
    w('posgrado_doc_url', p.POSGRADO_DOC_URL);
    w('cv_archivo', p.CV_ARCHIVO);
    w('certificado_no_agresor_archivo', p.CERTIFICADO_NO_AGRESOR_ARCHIVO);
    w('antecedente_judicial_archivo', p.ANTECEDENTE_JUDICIAL_ARCHIVO);
    w('antecedente_policial_archivo', p.ANTECEDENTE_POLICIAL_ARCHIVO);
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
    l_usuario  VARCHAR2(255);
    l_proceso  CLOB;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    anio_abierto(l_id_anio, l_anio);

    -- Las etapas y requisitos del proceso de ese año (ANIOS_LECTIVOS.PROCESO_POSTULACION,
    -- Jose 24/11/2026): la app los muestra al principio y pide el acuerdo para seguir.
    FOR a IN (SELECT PROCESO_POSTULACION FROM ANIOS_LECTIVOS WHERE ID_ANIO = l_id_anio) LOOP
        l_proceso := a.PROCESO_POSTULACION;
    END LOOP;

    -- Solo SUS postulaciones: por su ID_FACILITADOR (si es facilitador) o por
    -- su USUARIO (las que cargo desde la app, sea o no facilitador). Las
    -- INCOMPLETO (guardadas sin terminar) no cuentan como enviadas: la app las
    -- retoma desde el borrador.
    IF l_id_anio IS NOT NULL THEN
        BEGIN
            SELECT * INTO l_actual FROM POSTULANTES_FACILITADORES
             WHERE (ID_FACILITADOR = l_fac OR USUARIO = l_usuario) AND ID_ANIO = l_id_anio
               AND NVL(ESTADO, '-') <> c_estado_borrador
             ORDER BY CASE WHEN USUARIO = l_usuario THEN 0 ELSE 1 END, ID DESC
             FETCH FIRST 1 ROWS ONLY;
            l_hay_act := TRUE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN NULL;
        END;
    END IF;
    BEGIN
        SELECT * INTO l_anterior FROM POSTULANTES_FACILITADORES
         WHERE (ID_FACILITADOR = l_fac OR USUARIO = l_usuario)
           AND (l_id_anio IS NULL OR ID_ANIO <> l_id_anio)
           AND NVL(ESTADO, '-') <> c_estado_borrador
         ORDER BY FECHA_REGISTRO DESC, ID DESC FETCH FIRST 1 ROWS ONLY;
        l_hay_ant := TRUE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN NULL;
    END;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('es_facilitador', l_fac IS NOT NULL);
    w('anio', l_anio);
    -- anio_registrado: el año lectivo actual esta en ANIOS_LECTIVOS. abierta: el
    -- periodo de postulacion permite cargar y modificar (FN_POSTULACION_ABIERTA).
    APEX_JSON.WRITE('anio_registrado', l_id_anio IS NOT NULL);
    APEX_JSON.WRITE('abierta', periodo_abierto(l_id_anio));
    FOR pp IN (SELECT TO_CHAR(FECHA_INICIO, 'YYYY-MM-DD') AS inicio, TO_CHAR(FECHA_FIN, 'YYYY-MM-DD') AS fin,
                      HABILITACION_EXTRAORDINARIA AS extra
                 FROM PERIODOS_POSTULACION WHERE ID_ANIO = l_id_anio) LOOP
        APEX_JSON.OPEN_OBJECT('periodo');
        w('fecha_inicio', pp.inicio);
        w('fecha_fin', pp.fin);
        APEX_JSON.WRITE('extraordinaria', pp.extra = 'SI');
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    -- Texto (o HTML del editor de APEX) del proceso; null si no esta cargado.
    APEX_JSON.WRITE('proceso', l_proceso, p_write_null => TRUE);

    -- Sus datos de FACILITADORES (solo SU fila, por el ID del token), para precargar el
    -- formulario si ya es facilitador (Jose, 24/11/2026). Van como estan: la app los lleva a
    -- los codigos de la postulacion (SI/NO, SOLTERO, VIRTUAL...).
    APEX_JSON.OPEN_OBJECT('facilitador');
    FOR f IN (SELECT * FROM FACILITADORES WHERE ID_FACILITADOR = l_fac) LOOP
        w('nombre', f.NOMBRE_APELLIDO);
        w('cedula', f.NRO_CI);
        w('fecha_nacimiento', TO_CHAR(f.FECHA_NACIMIENTO, 'YYYY-MM-DD'));
        w('estado_civil', f.ESTADO_CIVIL);
        w('con_quien_vive', f.CON_QUIEN_VIVE);
        w('hijos', f.HIJOS);
        w('telefono', f.TELEFONO);
        w('email', f.EMAIL);
        APEX_JSON.WRITE('id_pais', f.ID_PAIS);
        APEX_JSON.WRITE('id_departamento', f.ID_DEPARTAMENTO);
        APEX_JSON.WRITE('id_ciudad', f.ID_CIUDAD);
        w('direccion', f.DIRECCION);
        w('ubicacion', f.UBICACION);
        w('vehiculo', f.VEHICULO);
        w('tipo_vehiculo', f.TIPO_VEHICULO);
        w('computadora', f.COMPUTADORA);
        w('internet', f.INTERNET);
        w('office', f.OFFICE);
        w('denominacion', denominacion(l_fac));
        w('nombre_iglesia', f.NOMBRE_IGLESIA);
        w('nombre_pastor', f.NOMBRE_PASTOR);
        w('telefono_pastor', f.NRO_TELEFONO_PASTOR);
        w('nombre_lider', f.NOMBRE_LIDER);
        w('telefono_lider', f.NRO_TELEFONO_LIDER);
        w('bautizado_agua', f.BAUTIZADO_AGUA);
        w('area_servicio', f.AREA_SERVICIO);
        w('banco', f.NOMBRE_BANCO);
        w('sucursal', f.SUCURSAL_BANCO);
        w('titular', f.TITULAR_BANCO);
        w('titular_ci', f.NRO_CI_TITULAR_BANCO);
        w('tipo_cuenta', f.TIPO_CUENTA);
        w('numero_cuenta', f.NRO_CUENTA);
        w('emisor', f.NOMBRE_EMISOR);
        w('ruc', f.RUC);
        w('tipo_factura', f.TIPO_FACTURA);
    END LOOP;
    APEX_JSON.CLOSE_OBJECT;

    IF l_hay_act THEN escribir('postulacion', l_actual); END IF;
    IF l_hay_ant THEN escribir('anterior', l_anterior); END IF;
    -- Lo guardado sin terminar este año (solo el de SU usuario): datos va como
    -- texto JSON, la app lo lee.
    FOR b IN (SELECT DATOS, PASO, TO_CHAR(FECHA, 'YYYY-MM-DD"T"HH24:MI') AS fecha
                FROM POSTULANTES_FAC_BORRADORES
               WHERE USUARIO = l_usuario AND ID_ANIO = l_id_anio) LOOP
        APEX_JSON.OPEN_OBJECT('borrador');
        APEX_JSON.WRITE('paso', b.PASO);
        w('fecha', b.fecha);
        APEX_JSON.WRITE('datos', b.DATOS);
        APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END mi_postulacion;

/* -------------------------------------------------------------------------- */
/* GET mi-postulacion/lugares                                                 */
/* -------------------------------------------------------------------------- */

PROCEDURE lugares(p_token IN VARCHAR2, p_id_pais IN VARCHAR2) IS
    l_fac     NUMBER;
    l_usuario VARCHAR2(255);
    l_pais    NUMBER := NVL(f_numero(p_id_pais), c_pais_defecto);
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;

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
/* Lectura del formulario y escritura en POSTULANTES_FACILITADORES            */
/* -------------------------------------------------------------------------- */

-- Lee del JSON ya parseado (APEX_JSON global) las columnas del formulario.
-- Estricto (g_suave = FALSE, al ENVIAR): el primer dato que falta o no es
-- valido corta con e_dato (campo y mensaje). Suave (g_suave = TRUE, al GUARDAR
-- sin terminar; Jose, 24/11/2026): ese dato queda NULL y se sigue, asi los
-- administradores ven lo cargado. Despues de cada falla() el campo se deja en
-- NULL: en modo estricto esa linea no se alcanza.
PROCEDURE leer_formulario(r IN OUT NOCOPY POSTULANTES_FACILITADORES%ROWTYPE) IS
    l_n       PLS_INTEGER;
    l_dia     VARCHAR2(4000);
    l_elegido VARCHAR2(4000) := ',';
BEGIN
    -- 1. El proceso: sin acuerdo no se registra nada (el que llama lo controla en modo suave).
    r.ACEPTA_PROCESO := opcion('acepta_proceso', 'acuerdo con el proceso', 'DE_ACUERDO,NO_DE_ACUERDO');
    IF NVL(r.ACEPTA_PROCESO, '-') <> 'DE_ACUERDO' THEN
        falla('acepta_proceso', 'Para postularte tenes que estar de acuerdo con el proceso');
    END IF;

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
        r.FECHA_NACIMIENTO := NULL;
        r.EDAD := NULL;
    END IF;
    r.NACIONALIDAD       := texto('nacionalidad', 'nacionalidad', 100);
    r.TELEFONO           := telefono('telefono', 'telefono');
    r.CORREO_ELECTRONICO := LOWER(texto('correo_electronico', 'correo electronico', 200));
    IF NOT REGEXP_LIKE(r.CORREO_ELECTRONICO, '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
        falla('correo_electronico', 'El correo electronico no es valido');
        r.CORREO_ELECTRONICO := NULL;
    END IF;
    r.ESTADO_CIVIL := opcion('estado_civil', 'estado civil', 'SOLTERO,CASADO,OTROS');
    r.ESTADO_CIVIL_OTRO := NULL;
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
    IF l_n = 0 AND r.ID_CIUDAD IS NOT NULL THEN
        falla('id_ciudad', 'La ciudad no es del departamento elegido');
        r.ID_CIUDAD := NULL;
    END IF;
    -- Un departamento que no existe tampoco se guarda (POSTULANTES_FAC_FK_DEPARTAMENTOS
    -- lo rechazaria).
    IF r.ID_DEPARTAMENTO IS NOT NULL THEN
        SELECT COUNT(*) INTO l_n FROM DEPARTAMENTOS
         WHERE ID_PAIS = r.ID_PAIS AND ID_DEPARTAMENTO = r.ID_DEPARTAMENTO;
        IF l_n = 0 THEN
            falla('id_departamento', 'El departamento no existe');
            r.ID_DEPARTAMENTO := NULL;
            r.ID_CIUDAD := NULL;
        END IF;
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
    r.EMPRESA := NULL;
    r.CARGO   := NULL;
    IF r.ACTIVIDAD_LABORAL = 'SI' THEN
        r.EMPRESA := texto('empresa', 'empresa donde trabajas', 200);
        r.CARGO   := texto('cargo', 'cargo', 200);
    END IF;
    r.MOVILIDAD_PROPIA := opcion('movilidad_propia', 'si tenes movilidad propia', 'SI,NO');
    r.TIPO_VEHICULO := NULL;
    IF r.MOVILIDAD_PROPIA = 'SI' THEN
        r.TIPO_VEHICULO := opcion('tipo_vehiculo', 'tipo de vehiculo', 'AUTO,MOTOCICLETA');
    END IF;
    r.COMPUTADORA_PROPIA := opcion('computadora_propia', 'si tenes computadora propia', 'SI,NO');
    r.INTERNET_ESTABLE   := opcion('internet_estable', 'si tenes internet estable', 'SI,NO');
    r.MANEJO_OFFICE      := opcion('manejo_office', 'si manejas Office', 'SI,NO');

    -- 6. Disponibilidad: los dias elegidos (los validos), en el orden de la semana.
    FOR i IN 1 .. NVL(APEX_JSON.GET_COUNT(p_path => 'dias_disponibles'), 0) LOOP
        l_dia := UPPER(TRIM(APEX_JSON.GET_VARCHAR2(p_path => 'dias_disponibles[%d]', p0 => i)));
        IF INSTR(',' || c_dias || ',', ',' || l_dia || ',') = 0 THEN
            falla('dias_disponibles', 'Dia no valido: ' || l_dia);
        ELSE
            l_elegido := l_elegido || l_dia || ',';
        END IF;
    END LOOP;
    r.DIAS_DISPONIBLES := NULL;
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
        r.AREAS_MINISTERIO := NULL;
    ELSIF DBMS_LOB.GETLENGTH(r.AREAS_MINISTERIO) > c_largo_areas THEN
        falla('areas_ministerio', 'Areas en las que servis: hasta ' || c_largo_areas || ' caracteres');
        r.AREAS_MINISTERIO := NULL;
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
        r.RUC := NULL;
    END IF;

    -- 9. Documentos (enlaces de Cloudinary), segun los estudios.
    r.FOTO_URL             := documento('foto_url', 'foto tipo carnet', TRUE);
    r.CEDULA_FRENTE_URL    := documento('cedula_frente_url', 'cedula, frente', TRUE);
    r.CEDULA_DORSO_URL     := documento('cedula_dorso_url', 'cedula, dorso', TRUE);
    r.SECUNDARIO_DOC_URL   := documento('secundario_doc_url', 'titulo de bachiller', pide_doc(r.SECUNDARIO_ESTADO));
    r.TECNICO_DOC_URL      := documento('tecnico_doc_url', 'titulo o constancia del tecnico superior', pide_doc(r.TECNICO_ESTADO));
    r.LICENCIATURA_DOC_URL := documento('licenciatura_doc_url', 'titulo o constancia de la licenciatura', pide_doc(r.LICENCIATURA_ESTADO));
    r.POSGRADO_DOC_URL     := documento('posgrado_doc_url', 'titulo o constancia del posgrado', pide_doc(r.POSGRADO_ESTADO));
    r.CV_ARCHIVO                     := documento('cv_archivo', 'curriculum (CV)', TRUE);
    r.CERTIFICADO_NO_AGRESOR_ARCHIVO := documento('certificado_no_agresor_archivo', 'certificado de no agresor', TRUE);
    r.ANTECEDENTE_JUDICIAL_ARCHIVO   := documento('antecedente_judicial_archivo', 'antecedentes judiciales', TRUE);
    r.ANTECEDENTE_POLICIAL_ARCHIVO   := documento('antecedente_policial_archivo', 'antecedentes policiales', TRUE);
END leer_formulario;

-- Escribe las columnas del formulario de r en la postulacion del usuario y año
-- (r.USUARIO, r.ID_ANIO, r.ID_FACILITADOR): alta o actualizacion. NO hace COMMIT.
--   p_enviar = TRUE  (enviada completa): ESTADO pasa de INCOMPLETO a PENDIENTE y
--                    FECHA_REGISTRO queda en la de ese primer envio. Si ya estaba
--                    enviada (correccion), ESTADO y FECHA_REGISTRO no se tocan.
--   p_enviar = FALSE (guardada sin terminar): queda ESTADO = INCOMPLETO. Si ya
--                    estaba enviada NO se pisa con datos a medias: esa correccion
--                    queda solo en POSTULANTES_FAC_BORRADORES hasta enviarla.
-- La app nunca escribe las columnas del administrador: en el alta toman su DEFAULT.
-- o_viejo: la fila anterior (para limpiar documentos reemplazados).
PROCEDURE grabar(r IN OUT NOCOPY POSTULANTES_FACILITADORES%ROWTYPE, p_enviar IN BOOLEAN,
                 o_viejo OUT POSTULANTES_FACILITADORES%ROWTYPE,
                 o_escrita OUT BOOLEAN, o_primer_envio OUT BOOLEAN) IS
    l_id   NUMBER;
    l_fac  NUMBER := r.ID_FACILITADOR;
    l_borr BOOLEAN;
BEGIN
    o_escrita      := FALSE;
    o_primer_envio := FALSE;

    -- Una por usuario y año. Si es facilitador, su fila de FACILITADORES queda
    -- bloqueada hasta el COMMIT; para todos, el indice unico
    -- UX_POSTULANTES_FAC_USUARIO_ANIO frena un segundo alta a la vez (409).
    IF l_fac IS NOT NULL THEN
        SELECT ID_FACILITADOR INTO l_fac FROM FACILITADORES WHERE ID_FACILITADOR = l_fac FOR UPDATE;
    END IF;
    -- La suya del año: primero la que ya tiene su USUARIO.
    BEGIN
        SELECT ID INTO l_id FROM POSTULANTES_FACILITADORES
         WHERE (ID_FACILITADOR = l_fac OR USUARIO = r.USUARIO) AND ID_ANIO = r.ID_ANIO
         ORDER BY CASE WHEN USUARIO = r.USUARIO THEN 0 ELSE 1 END, ID DESC
         FETCH FIRST 1 ROWS ONLY;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN l_id := NULL;
    END;

    IF l_id IS NULL THEN
        r.ID             := NULL;
        r.ESTADO         := CASE WHEN p_enviar THEN c_estado_inicial ELSE c_estado_borrador END;
        r.FECHA_REGISTRO := CAST(ahora AS TIMESTAMP);
        INSERT INTO POSTULANTES_FACILITADORES (
            ESTADO,
            ID_FACILITADOR, USUARIO, ID_ANIO, FECHA_REGISTRO, ACEPTA_PROCESO,
            NOMBRE_COMPLETO, CEDULA, FECHA_NACIMIENTO, EDAD, NACIONALIDAD,
            TELEFONO, CORREO_ELECTRONICO, ESTADO_CIVIL, ESTADO_CIVIL_OTRO,
            VIVE_CON, HIJOS, TALLE_REMERA,
            ID_PAIS, ID_DEPARTAMENTO, ID_CIUDAD, DIRECCION, UBICACION_DOMICILIO,
            SECUNDARIO_ESTADO, SECUNDARIO_TITULO,
            TECNICO_ESTADO, TECNICO_TITULO, TECNICO_ANIO,
            LICENCIATURA_ESTADO, LICENCIATURA_TITULO, LICENCIATURA_ANIO,
            POSGRADO_ESTADO, POSGRADO_TITULO, POSGRADO_ANIO,
            ACTIVIDAD_LABORAL, EMPRESA, CARGO, MOVILIDAD_PROPIA, TIPO_VEHICULO,
            COMPUTADORA_PROPIA, INTERNET_ESTABLE, MANEJO_OFFICE,
            DIAS_DISPONIBLES, TURNO,
            IGLESIA_DENOMINACION, IGLESIA_NOMBRE, PASTOR_NOMBRE, PASTOR_TELEFONO,
            LIDER_NOMBRE, LIDER_TELEFONO, BAUTIZADO_AGUA, AREAS_MINISTERIO,
            BANCO_NOMBRE, BANCO_SUCURSAL, TITULAR_NOMBRE, TITULAR_CI,
            TIPO_CUENTA, NUMERO_CUENTA, FACTURA_TIPO, FACTURA_EMISOR, RUC,
            FOTO_URL, CEDULA_FRENTE_URL, CEDULA_DORSO_URL,
            SECUNDARIO_DOC_URL, TECNICO_DOC_URL, LICENCIATURA_DOC_URL, POSGRADO_DOC_URL,
            CV_ARCHIVO, CERTIFICADO_NO_AGRESOR_ARCHIVO,
            ANTECEDENTE_JUDICIAL_ARCHIVO, ANTECEDENTE_POLICIAL_ARCHIVO
        ) VALUES (
            r.ESTADO,
            r.ID_FACILITADOR, r.USUARIO, r.ID_ANIO, r.FECHA_REGISTRO, r.ACEPTA_PROCESO,
            r.NOMBRE_COMPLETO, r.CEDULA, r.FECHA_NACIMIENTO, r.EDAD, r.NACIONALIDAD,
            r.TELEFONO, r.CORREO_ELECTRONICO, r.ESTADO_CIVIL, r.ESTADO_CIVIL_OTRO,
            r.VIVE_CON, r.HIJOS, r.TALLE_REMERA,
            r.ID_PAIS, r.ID_DEPARTAMENTO, r.ID_CIUDAD, r.DIRECCION, r.UBICACION_DOMICILIO,
            r.SECUNDARIO_ESTADO, r.SECUNDARIO_TITULO,
            r.TECNICO_ESTADO, r.TECNICO_TITULO, r.TECNICO_ANIO,
            r.LICENCIATURA_ESTADO, r.LICENCIATURA_TITULO, r.LICENCIATURA_ANIO,
            r.POSGRADO_ESTADO, r.POSGRADO_TITULO, r.POSGRADO_ANIO,
            r.ACTIVIDAD_LABORAL, r.EMPRESA, r.CARGO, r.MOVILIDAD_PROPIA, r.TIPO_VEHICULO,
            r.COMPUTADORA_PROPIA, r.INTERNET_ESTABLE, r.MANEJO_OFFICE,
            r.DIAS_DISPONIBLES, r.TURNO,
            r.IGLESIA_DENOMINACION, r.IGLESIA_NOMBRE, r.PASTOR_NOMBRE, r.PASTOR_TELEFONO,
            r.LIDER_NOMBRE, r.LIDER_TELEFONO, r.BAUTIZADO_AGUA, r.AREAS_MINISTERIO,
            r.BANCO_NOMBRE, r.BANCO_SUCURSAL, r.TITULAR_NOMBRE, r.TITULAR_CI,
            r.TIPO_CUENTA, r.NUMERO_CUENTA, r.FACTURA_TIPO, r.FACTURA_EMISOR, r.RUC,
            r.FOTO_URL, r.CEDULA_FRENTE_URL, r.CEDULA_DORSO_URL,
            r.SECUNDARIO_DOC_URL, r.TECNICO_DOC_URL, r.LICENCIATURA_DOC_URL, r.POSGRADO_DOC_URL,
            r.CV_ARCHIVO, r.CERTIFICADO_NO_AGRESOR_ARCHIVO,
            r.ANTECEDENTE_JUDICIAL_ARCHIVO, r.ANTECEDENTE_POLICIAL_ARCHIVO
        ) RETURNING ID INTO r.ID;
        o_escrita      := TRUE;
        o_primer_envio := p_enviar;
        RETURN;
    END IF;

    SELECT * INTO o_viejo FROM POSTULANTES_FACILITADORES WHERE ID = l_id;
    -- Sin enviar todavia = INCOMPLETO. Una sin ESTADO cuenta como enviada (no se pisa a medias).
    l_borr := NVL(o_viejo.ESTADO, '-') = c_estado_borrador;
    IF NOT p_enviar AND NOT l_borr THEN
        RETURN;
    END IF;
    o_primer_envio   := p_enviar AND l_borr;
    r.ID             := l_id;
    r.ESTADO         := CASE
                            WHEN NOT p_enviar THEN c_estado_borrador
                            WHEN l_borr OR o_viejo.ESTADO IS NULL THEN c_estado_inicial
                            ELSE o_viejo.ESTADO
                        END;
    r.FECHA_REGISTRO := CASE WHEN o_primer_envio THEN CAST(ahora AS TIMESTAMP) ELSE o_viejo.FECHA_REGISTRO END;
    UPDATE POSTULANTES_FACILITADORES SET
        ESTADO = r.ESTADO, FECHA_REGISTRO = r.FECHA_REGISTRO,
        ID_FACILITADOR = r.ID_FACILITADOR, USUARIO = r.USUARIO, ID_ANIO = r.ID_ANIO,
        ACEPTA_PROCESO = r.ACEPTA_PROCESO,
        NOMBRE_COMPLETO = r.NOMBRE_COMPLETO, CEDULA = r.CEDULA,
        FECHA_NACIMIENTO = r.FECHA_NACIMIENTO, EDAD = r.EDAD, NACIONALIDAD = r.NACIONALIDAD,
        TELEFONO = r.TELEFONO, CORREO_ELECTRONICO = r.CORREO_ELECTRONICO,
        ESTADO_CIVIL = r.ESTADO_CIVIL, ESTADO_CIVIL_OTRO = r.ESTADO_CIVIL_OTRO,
        VIVE_CON = r.VIVE_CON, HIJOS = r.HIJOS, TALLE_REMERA = r.TALLE_REMERA,
        ID_PAIS = r.ID_PAIS, ID_DEPARTAMENTO = r.ID_DEPARTAMENTO, ID_CIUDAD = r.ID_CIUDAD,
        DIRECCION = r.DIRECCION, UBICACION_DOMICILIO = r.UBICACION_DOMICILIO,
        SECUNDARIO_ESTADO = r.SECUNDARIO_ESTADO, SECUNDARIO_TITULO = r.SECUNDARIO_TITULO,
        TECNICO_ESTADO = r.TECNICO_ESTADO, TECNICO_TITULO = r.TECNICO_TITULO, TECNICO_ANIO = r.TECNICO_ANIO,
        LICENCIATURA_ESTADO = r.LICENCIATURA_ESTADO, LICENCIATURA_TITULO = r.LICENCIATURA_TITULO,
        LICENCIATURA_ANIO = r.LICENCIATURA_ANIO,
        POSGRADO_ESTADO = r.POSGRADO_ESTADO, POSGRADO_TITULO = r.POSGRADO_TITULO, POSGRADO_ANIO = r.POSGRADO_ANIO,
        ACTIVIDAD_LABORAL = r.ACTIVIDAD_LABORAL, EMPRESA = r.EMPRESA, CARGO = r.CARGO,
        MOVILIDAD_PROPIA = r.MOVILIDAD_PROPIA, TIPO_VEHICULO = r.TIPO_VEHICULO,
        COMPUTADORA_PROPIA = r.COMPUTADORA_PROPIA, INTERNET_ESTABLE = r.INTERNET_ESTABLE,
        MANEJO_OFFICE = r.MANEJO_OFFICE,
        DIAS_DISPONIBLES = r.DIAS_DISPONIBLES, TURNO = r.TURNO,
        IGLESIA_DENOMINACION = r.IGLESIA_DENOMINACION, IGLESIA_NOMBRE = r.IGLESIA_NOMBRE,
        PASTOR_NOMBRE = r.PASTOR_NOMBRE, PASTOR_TELEFONO = r.PASTOR_TELEFONO,
        LIDER_NOMBRE = r.LIDER_NOMBRE, LIDER_TELEFONO = r.LIDER_TELEFONO,
        BAUTIZADO_AGUA = r.BAUTIZADO_AGUA, AREAS_MINISTERIO = r.AREAS_MINISTERIO,
        BANCO_NOMBRE = r.BANCO_NOMBRE, BANCO_SUCURSAL = r.BANCO_SUCURSAL,
        TITULAR_NOMBRE = r.TITULAR_NOMBRE, TITULAR_CI = r.TITULAR_CI,
        TIPO_CUENTA = r.TIPO_CUENTA, NUMERO_CUENTA = r.NUMERO_CUENTA,
        FACTURA_TIPO = r.FACTURA_TIPO, FACTURA_EMISOR = r.FACTURA_EMISOR, RUC = r.RUC,
        FOTO_URL = r.FOTO_URL, CEDULA_FRENTE_URL = r.CEDULA_FRENTE_URL, CEDULA_DORSO_URL = r.CEDULA_DORSO_URL,
        SECUNDARIO_DOC_URL = r.SECUNDARIO_DOC_URL, TECNICO_DOC_URL = r.TECNICO_DOC_URL,
        LICENCIATURA_DOC_URL = r.LICENCIATURA_DOC_URL, POSGRADO_DOC_URL = r.POSGRADO_DOC_URL,
        CV_ARCHIVO = r.CV_ARCHIVO, CERTIFICADO_NO_AGRESOR_ARCHIVO = r.CERTIFICADO_NO_AGRESOR_ARCHIVO,
        ANTECEDENTE_JUDICIAL_ARCHIVO = r.ANTECEDENTE_JUDICIAL_ARCHIVO,
        ANTECEDENTE_POLICIAL_ARCHIVO = r.ANTECEDENTE_POLICIAL_ARCHIVO
     WHERE ID = l_id;
    o_escrita := TRUE;
END grabar;

-- Despues del COMMIT: borra de Cloudinary los documentos de una fila vieja que
-- ya no use ninguna postulacion. Nunca lanza.
PROCEDURE limpiar_fila(p IN POSTULANTES_FACILITADORES%ROWTYPE) IS
BEGIN
    limpiar(p.FOTO_URL);
    limpiar(p.CEDULA_FRENTE_URL);
    limpiar(p.CEDULA_DORSO_URL);
    limpiar(p.SECUNDARIO_DOC_URL);
    limpiar(p.TECNICO_DOC_URL);
    limpiar(p.LICENCIATURA_DOC_URL);
    limpiar(p.POSGRADO_DOC_URL);
    limpiar(p.CV_ARCHIVO);
    limpiar(p.CERTIFICADO_NO_AGRESOR_ARCHIVO);
    limpiar(p.ANTECEDENTE_JUDICIAL_ARCHIVO);
    limpiar(p.ANTECEDENTE_POLICIAL_ARCHIVO);
END limpiar_fila;

-- Para un ORA-02290: la condicion de la CHECK que fallo, para que el mensaje diga
-- que dato fue y no solo "SYS_C00206268478" (24/11/2026). NULL si no se encuentra.
FUNCTION regla_check(p_sqlerrm IN VARCHAR2) RETURN VARCHAR2 IS
    l_nombre VARCHAR2(128) := REGEXP_SUBSTR(p_sqlerrm, '\.([A-Za-z0-9_$#]+)\)', 1, 1, NULL, 1);
    l_cond   VARCHAR2(4000);
BEGIN
    SELECT SEARCH_CONDITION_VC INTO l_cond FROM USER_CONSTRAINTS WHERE CONSTRAINT_NAME = l_nombre;
    RETURN l_cond;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END regla_check;

/* -------------------------------------------------------------------------- */
/* POST mi-postulacion                                                        */
/* -------------------------------------------------------------------------- */

PROCEDURE guardar(p_token IN VARCHAR2, p_body IN CLOB) IS
    l_fac     NUMBER;
    l_id_anio NUMBER;
    l_anio    VARCHAR2(40);
    r         POSTULANTES_FACILITADORES%ROWTYPE;
    l_viejo   POSTULANTES_FACILITADORES%ROWTYPE;
    l_usuario VARCHAR2(255);
    l_escrita BOOLEAN;
    l_primera BOOLEAN;
BEGIN
    -- Enviar valida TODO: nunca en modo suave (la variable vive en la sesion de
    -- ORDS, que se reutiliza entre pedidos).
    g_suave := FALSE;
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;

    anio_abierto(l_id_anio, l_anio);
    IF l_id_anio IS NULL THEN
        p_error(409, 'Conflict', 'No hay un año lectivo abierto para postularse'); RETURN;
    END IF;
    IF NOT periodo_abierto(l_id_anio) THEN
        p_error(409, 'Conflict', 'El periodo de postulacion esta cerrado: ya no se pueden cargar ni modificar postulaciones'); RETURN;
    END IF;

    BEGIN
        APEX_JSON.PARSE(p_source => p_body);
    EXCEPTION
        WHEN OTHERS THEN
            p_error(400, 'Bad Request', 'Los datos enviados no son validos'); RETURN;
    END;

    leer_formulario(r);

    r.ID_FACILITADOR := l_fac;
    r.USUARIO        := l_usuario;
    r.ID_ANIO        := l_id_anio;
    grabar(r, TRUE, l_viejo, l_escrita, l_primera);
    COMMIT;

    -- Enviada completa: lo guardado sin terminar ya no hace falta.
    DELETE FROM POSTULANTES_FAC_BORRADORES WHERE USUARIO = l_usuario AND ID_ANIO = l_id_anio;
    COMMIT;

    -- Despues del COMMIT: los documentos reemplazados se borran de Cloudinary.
    limpiar_fila(l_viejo);

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('id', r.ID);
    APEX_JSON.WRITE('nueva', l_primera);
    APEX_JSON.WRITE('message', CASE WHEN l_primera THEN 'Postulacion enviada' ELSE 'Postulacion actualizada' END);
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN e_dato THEN
        ROLLBACK;
        p_error(400, 'Bad Request', g_mensaje, g_campo);
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        p_error(409, 'Conflict', 'Tu postulacion de este año ya se esta guardando. Actualiza la pantalla y corregila desde ahi.');
    WHEN OTHERS THEN
        ROLLBACK;
        IF SQLCODE = -2290 THEN
            p_error(400, 'Bad Request', 'Hay una opcion no valida (' || NVL(regla_check(SQLERRM), SQLERRM) || ')');
        ELSIF SQLCODE = -2291 THEN
            p_error(400, 'Bad Request', 'El departamento o la ciudad no existen', 'id_ciudad');
        ELSE
            p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
        END IF;
END guardar;

/* -------------------------------------------------------------------------- */
/* POST mi-postulacion/firma-documento                                        */
/* -------------------------------------------------------------------------- */

-- Misma forma que mis-facturas/firma-foto, pero con el preset de las
-- postulaciones. El cloud y el api_key se toman de lo que escribe
-- PKG_CLOUDINARY_ETHOS.escribir_firma (asi no dependemos de como se llaman en
-- CLOUDINARY_CONFIG); la firma se rehace aca con el secreto:
--   SHA-1( 'asset_folder=..&public_id=..&timestamp=..&upload_preset=..' || secreto )
-- El public_id (nombre del archivo en Cloudinary) lo elige el servidor, al
-- azar, y lo anota a nombre del usuario en POSTULANTES_FAC_ARCHIVOS: asi solo
-- ese usuario puede borrarlo despues (quitar_documento).
PROCEDURE firma_documento(p_token IN VARCHAR2) IS
    l_pid     VARCHAR2(200);
    l_fecha   DATE;
    l_fac     NUMBER;
    l_id_anio NUMBER;
    l_anio    VARCHAR2(40);
    l_falta   VARCHAR2(400);
    l_base    CLOB;
    l_vals    APEX_JSON.T_VALUES;
    l_cloud   VARCHAR2(400);
    l_key     VARCHAR2(400);
    l_secreto VARCHAR2(4000);
    l_ts      VARCHAR2(20);
    l_cadena  VARCHAR2(4000);
    l_firma   VARCHAR2(100);
    l_usuario VARCHAR2(255);
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    anio_abierto(l_id_anio, l_anio);
    IF l_id_anio IS NULL THEN
        p_error(409, 'Conflict', 'No hay un año lectivo abierto para postularse'); RETURN;
    END IF;
    IF NOT periodo_abierto(l_id_anio) THEN
        p_error(409, 'Conflict', 'El periodo de postulacion esta cerrado: ya no se pueden cargar ni modificar postulaciones'); RETURN;
    END IF;
    l_falta := PKG_CLOUDINARY_ETHOS.falta;
    IF l_falta IS NOT NULL THEN
        p_error(503, 'Service Unavailable', 'Todavia no se pueden subir documentos: ' || l_falta); RETURN;
    END IF;
    l_secreto := secreto;
    IF l_secreto IS NULL THEN
        p_error(503, 'Service Unavailable', 'Todavia no se pueden subir documentos: no se encontro el secreto de Cloudinary'); RETURN;
    END IF;

    -- Lo que firma PKG_CLOUDINARY_ETHOS, a un CLOB (no al HTTP). OJO: despues de
    -- FREE_OUTPUT la salida de APEX_JSON ya no llega al HTTP (la respuesta salia
    -- vacia), asi que de aca en adelante la respuesta se escribe con HTP.P.
    APEX_JSON.INITIALIZE_CLOB_OUTPUT;
    BEGIN
        APEX_JSON.OPEN_OBJECT;
        PKG_CLOUDINARY_ETHOS.escribir_firma(c_carpeta_docs);
        APEX_JSON.CLOSE_OBJECT;
        l_base := APEX_JSON.GET_CLOB_OUTPUT;
        APEX_JSON.FREE_OUTPUT;
    EXCEPTION
        WHEN OTHERS THEN
            APEX_JSON.FREE_OUTPUT;
            RAISE;
    END;
    APEX_JSON.PARSE(p_values => l_vals, p_source => l_base);
    l_cloud := APEX_JSON.GET_VARCHAR2(p_path => 'cloud_name', p_values => l_vals);
    BEGIN
        l_key := APEX_JSON.GET_VARCHAR2(p_path => 'campos.api_key', p_values => l_vals);
    EXCEPTION
        WHEN OTHERS THEN
            l_key := TO_CHAR(APEX_JSON.GET_NUMBER(p_path => 'campos.api_key', p_values => l_vals));
    END;
    IF l_cloud IS NULL OR l_key IS NULL THEN
        error_htp(503, 'Service Unavailable', 'Todavia no se pueden subir documentos: falta el cloud o la clave de Cloudinary'); RETURN;
    END IF;

    -- Segundos desde 1970 (UTC), como pide Cloudinary.
    l_ts := TO_CHAR(ROUND((CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) - DATE '1970-01-01') * 86400));
    -- Parametros en orden alfabetico, sin file, cloud_name, resource_type ni api_key.
    -- CHR(38) = '&' (asi ningun cliente SQL lo toma como variable de sustitucion).
    l_pid := c_carpeta_docs || '/pf_' || LOWER(DBMS_RANDOM.STRING('X', 24));
    l_cadena := 'asset_folder=' || c_carpeta_docs || CHR(38) || 'public_id=' || l_pid
                || CHR(38) || 'timestamp=' || l_ts
                || CHR(38) || 'upload_preset=' || c_preset_docs || l_secreto;
    SELECT LOWER(RAWTOHEX(STANDARD_HASH(l_cadena, 'SHA1'))) INTO l_firma FROM dual;

    -- ahora() es privada del paquete: no se puede llamar dentro de SQL (PLS-00231).
    l_fecha := ahora;
    INSERT INTO POSTULANTES_FAC_ARCHIVOS (USUARIO, PUBLIC_ID, FECHA) VALUES (l_usuario, l_pid, l_fecha);
    COMMIT;

    -- auto: acepta fotos y PDF.
    abrir_json;
    HTP.P('{"success":true'
          || ',"cloud_name":' || APEX_JSON.STRINGIFY(l_cloud)
          || ',"upload_url":' || APEX_JSON.STRINGIFY('https://api.cloudinary.com/v1_1/' || l_cloud || '/auto/upload')
          || ',"campos":{'
          ||   '"api_key":' || APEX_JSON.STRINGIFY(l_key)
          ||   ',"public_id":' || APEX_JSON.STRINGIFY(l_pid)
          ||   ',"timestamp":' || APEX_JSON.STRINGIFY(l_ts)
          ||   ',"upload_preset":' || APEX_JSON.STRINGIFY(c_preset_docs)
          ||   ',"asset_folder":' || APEX_JSON.STRINGIFY(c_carpeta_docs)
          ||   ',"signature":' || APEX_JSON.STRINGIFY(l_firma)
          || '}}');
EXCEPTION
    WHEN OTHERS THEN error_htp(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END firma_documento;

/* -------------------------------------------------------------------------- */
/* DELETE mi-postulacion/documento?url=                                       */
/* -------------------------------------------------------------------------- */

-- El usuario quito o reemplazo un documento en la app.
--   - Solo archivos que el servidor le firmo A EL (POSTULANTES_FAC_ARCHIVOS):
--     nunca uno ajeno ni uno de otro lado (p. ej. una factura). 404 si no.
--   - Si una postulacion guardada lo usa, no se borra ahora (borrado:false,
--     en_uso:true): se borra al guardar la correccion que lo reemplaza.
--   - Si no, se borra de Cloudinary (borrado:true) o se avisa por que no.
PROCEDURE quitar_documento(p_token IN VARCHAR2, p_url IN VARCHAR2) IS
    l_fac     NUMBER;
    l_usuario VARCHAR2(255);
    l_url     VARCHAR2(4000) := TRIM(p_url);
    l_n       PLS_INTEGER;
    l_r       VARCHAR2(4000);
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    IF l_url IS NULL OR LENGTH(l_url) > c_largo_url OR NOT PKG_CLOUDINARY_ETHOS.es_url_propia(l_url) THEN
        p_error(400, 'Bad Request', 'El enlace del documento no es valido'); RETURN;
    END IF;
    SELECT COUNT(*) INTO l_n FROM POSTULANTES_FAC_ARCHIVOS
     WHERE USUARIO = l_usuario AND INSTR(l_url, '/' || PUBLIC_ID || '.') > 0;
    IF l_n = 0 THEN
        p_error(404, 'Not Found', 'Ese documento no es tuyo o ya se borro'); RETURN;
    END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    IF en_uso(l_url) THEN
        APEX_JSON.WRITE('borrado', FALSE);
        APEX_JSON.WRITE('en_uso', TRUE);
    ELSE
        l_r := borrar_archivo(l_url);
        APEX_JSON.WRITE('borrado', l_r IS NULL);
        IF l_r IS NOT NULL THEN APEX_JSON.WRITE('aviso', l_r); END IF;
    END IF;
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END quitar_documento;

/* -------------------------------------------------------------------------- */
/* DELETE mi-postulacion                                                      */
/* -------------------------------------------------------------------------- */

-- El usuario elimina SU postulacion del año abierto para cargarla de nuevo
-- (Jose, 24/11/2026). La misma fila que devuelve el GET. Despues del COMMIT
-- se borran de Cloudinary sus documentos que ninguna otra postulacion use.
PROCEDURE eliminar(p_token IN VARCHAR2) IS
    l_fac     NUMBER;
    l_usuario VARCHAR2(255);
    l_id_anio NUMBER;
    l_anio    VARCHAR2(40);
    p         POSTULANTES_FACILITADORES%ROWTYPE;
    l_borrador CLOB;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    anio_abierto(l_id_anio, l_anio);
    IF l_id_anio IS NULL THEN
        p_error(409, 'Conflict', 'No hay un año lectivo abierto'); RETURN;
    END IF;
    IF NOT periodo_abierto(l_id_anio) THEN
        p_error(409, 'Conflict', 'El periodo de postulacion esta cerrado: ya no se pueden cargar ni modificar postulaciones'); RETURN;
    END IF;
    BEGIN
        SELECT * INTO p FROM POSTULANTES_FACILITADORES
         WHERE (ID_FACILITADOR = l_fac OR USUARIO = l_usuario) AND ID_ANIO = l_id_anio
         ORDER BY CASE WHEN USUARIO = l_usuario THEN 0 ELSE 1 END, ID DESC
         FETCH FIRST 1 ROWS ONLY;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN p.ID := NULL;
    END;
    FOR b IN (SELECT DATOS FROM POSTULANTES_FAC_BORRADORES
               WHERE USUARIO = l_usuario AND ID_ANIO = l_id_anio) LOOP
        l_borrador := b.DATOS;
    END LOOP;
    IF p.ID IS NULL AND l_borrador IS NULL THEN
        p_error(404, 'Not Found', 'No tenes una postulacion este año'); RETURN;
    END IF;

    IF p.ID IS NOT NULL THEN
        DELETE FROM POSTULANTES_FACILITADORES WHERE ID = p.ID;
    END IF;
    DELETE FROM POSTULANTES_FAC_BORRADORES WHERE USUARIO = l_usuario AND ID_ANIO = l_id_anio;
    COMMIT;

    limpiar_borrador(l_borrador);

    limpiar(p.FOTO_URL);
    limpiar(p.CEDULA_FRENTE_URL);
    limpiar(p.CEDULA_DORSO_URL);
    limpiar(p.SECUNDARIO_DOC_URL);
    limpiar(p.TECNICO_DOC_URL);
    limpiar(p.LICENCIATURA_DOC_URL);
    limpiar(p.POSGRADO_DOC_URL);
    limpiar(p.CV_ARCHIVO);
    limpiar(p.CERTIFICADO_NO_AGRESOR_ARCHIVO);
    limpiar(p.ANTECEDENTE_JUDICIAL_ARCHIVO);
    limpiar(p.ANTECEDENTE_POLICIAL_ARCHIVO);

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', 'Postulacion eliminada');
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        IF SQLCODE = -2292 THEN
            -- Otra tabla la referencia (p. ej. la coordinacion ya la tomo).
            p_error(409, 'Conflict', 'Tu postulacion ya esta en proceso y no se puede eliminar. Corregila o consulta con la coordinacion.');
        ELSE
            p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
        END IF;
END eliminar;

/* -------------------------------------------------------------------------- */
/* PUT / DELETE mi-postulacion/borrador                                       */
/* -------------------------------------------------------------------------- */

-- Guarda lo cargado SIN validar (Jose, 24/11/2026: ningun campo es
-- obligatorio para guardar). Cuerpo { paso, datos, postulacion }:
--   datos       el JSON del formulario tal cual, como texto: la app lo usa
--               para retomar donde quedo (POSTULANTES_FAC_BORRADORES).
--   postulacion el mismo formulario como lo manda el envio, como texto. Lo
--               valido va tambien a POSTULANTES_FACILITADORES con ESTADO =
--               INCOMPLETO, para que los administradores ya lo vean (Jose,
--               24/11/2026); lo que falta o no es valido queda NULL. Una app
--               vieja no lo manda: entonces solo se guarda el borrador.
PROCEDURE guardar_borrador(p_token IN VARCHAR2, p_body IN CLOB) IS
    l_fac     NUMBER;
    l_usuario VARCHAR2(255);
    l_id_anio NUMBER;
    l_anio    VARCHAR2(40);
    l_datos   CLOB;
    l_post    CLOB;
    l_paso    NUMBER;
    l_fecha   DATE;
    l_vals    APEX_JSON.T_VALUES;
    r         POSTULANTES_FACILITADORES%ROWTYPE;
    l_viejo   POSTULANTES_FACILITADORES%ROWTYPE;
    l_escrita BOOLEAN := FALSE;
    l_primera BOOLEAN;
BEGIN
    g_suave := FALSE;
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    anio_abierto(l_id_anio, l_anio);
    IF l_id_anio IS NULL THEN
        p_error(409, 'Conflict', 'No hay un año lectivo abierto para postularse'); RETURN;
    END IF;
    IF NOT periodo_abierto(l_id_anio) THEN
        p_error(409, 'Conflict', 'El periodo de postulacion esta cerrado: ya no se pueden cargar ni modificar postulaciones'); RETURN;
    END IF;
    BEGIN
        APEX_JSON.PARSE(p_source => p_body);
        l_datos := APEX_JSON.GET_CLOB(p_path => 'datos');
        l_post  := APEX_JSON.GET_CLOB(p_path => 'postulacion');
        l_paso  := f_numero(APEX_JSON.GET_VARCHAR2(p_path => 'paso'));
        APEX_JSON.PARSE(p_values => l_vals, p_source => l_datos);
    EXCEPTION
        WHEN OTHERS THEN
            p_error(400, 'Bad Request', 'Los datos enviados no son validos'); RETURN;
    END;
    IF l_datos IS NULL OR DBMS_LOB.GETLENGTH(l_datos) > c_largo_borrador THEN
        p_error(400, 'Bad Request', 'Los datos enviados no son validos'); RETURN;
    END IF;

    -- ahora() es privada: no se puede usar dentro del MERGE (PLS-00231).
    l_fecha := ahora;
    MERGE INTO POSTULANTES_FAC_BORRADORES b
    USING (SELECT l_usuario AS usuario, l_id_anio AS id_anio FROM dual) x
       ON (b.USUARIO = x.usuario AND b.ID_ANIO = x.id_anio)
     WHEN MATCHED THEN UPDATE SET b.DATOS = l_datos, b.PASO = l_paso,
                                  b.ID_FACILITADOR = l_fac, b.FECHA = l_fecha
     WHEN NOT MATCHED THEN INSERT (USUARIO, ID_ANIO, ID_FACILITADOR, DATOS, PASO, FECHA)
                           VALUES (l_usuario, l_id_anio, l_fac, l_datos, l_paso, l_fecha);

    -- Lo valido, tambien en POSTULANTES_FACILITADORES (INCOMPLETO). Sin acuerdo
    -- con el proceso no se registra nada ahi. Una ya enviada no se pisa (grabar).
    IF l_post IS NOT NULL AND DBMS_LOB.GETLENGTH(l_post) <= c_largo_borrador THEN
        BEGIN
            APEX_JSON.PARSE(p_source => l_post);
        EXCEPTION
            WHEN OTHERS THEN l_post := NULL;
        END;
        IF l_post IS NOT NULL
           AND UPPER(TRIM(APEX_JSON.GET_VARCHAR2(p_path => 'acepta_proceso'))) = 'DE_ACUERDO' THEN
            g_suave := TRUE;
            leer_formulario(r);
            g_suave := FALSE;
            r.ID_FACILITADOR := l_fac;
            r.USUARIO        := l_usuario;
            r.ID_ANIO        := l_id_anio;
            -- NOMBRE_COMPLETO y CEDULA aceptan vacio (el script les saca el NOT
            -- NULL): la fila aparece desde el primer Guardar con acuerdo.
            grabar(r, FALSE, l_viejo, l_escrita, l_primera);
        END IF;
    END IF;
    COMMIT;

    -- Documentos que la fila ya no usa (reemplazados o quitados).
    IF l_escrita THEN limpiar_fila(l_viejo); END IF;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    -- visible: si los administradores ya la ven (fila INCOMPLETO actualizada).
    APEX_JSON.WRITE('visible', l_escrita);
    APEX_JSON.WRITE('message', 'Guardada sin terminar');
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        g_suave := FALSE;
        ROLLBACK;
        IF SQLCODE = -1400 THEN
            -- Una columna obligatoria de la tabla que todavia no se cargo.
            p_error(400, 'Bad Request', 'Para guardar falta un dato obligatorio: ' || SQLERRM);
        ELSIF SQLCODE = -2290 THEN
            p_error(400, 'Bad Request', 'Hay una opcion no valida (' || NVL(regla_check(SQLERRM), SQLERRM) || ')');
        ELSE
            p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
        END IF;
END guardar_borrador;

PROCEDURE descartar_borrador(p_token IN VARCHAR2) IS
    l_fac      NUMBER;
    l_usuario  VARCHAR2(255);
    l_id_anio  NUMBER;
    l_anio     VARCHAR2(40);
    l_borrador CLOB;
    TYPE t_filas IS TABLE OF POSTULANTES_FACILITADORES%ROWTYPE;
    l_incomp   t_filas;
BEGIN
    IF NOT contexto(p_token, l_usuario, l_fac) THEN RETURN; END IF;
    anio_abierto(l_id_anio, l_anio);
    FOR b IN (SELECT DATOS FROM POSTULANTES_FAC_BORRADORES
               WHERE USUARIO = l_usuario AND ID_ANIO = l_id_anio) LOOP
        l_borrador := b.DATOS;
    END LOOP;
    -- La copia INCOMPLETO de POSTULANTES_FACILITADORES tambien se descarta (una
    -- ya enviada no: esa se borra con "Eliminar mi postulacion").
    SELECT * BULK COLLECT INTO l_incomp FROM POSTULANTES_FACILITADORES
     WHERE (ID_FACILITADOR = l_fac OR USUARIO = l_usuario) AND ID_ANIO = l_id_anio
       AND ESTADO = c_estado_borrador;
    FOR i IN 1 .. l_incomp.COUNT LOOP
        DELETE FROM POSTULANTES_FACILITADORES WHERE ID = l_incomp(i).ID;
    END LOOP;
    DELETE FROM POSTULANTES_FAC_BORRADORES WHERE USUARIO = l_usuario AND ID_ANIO = l_id_anio;
    COMMIT;
    limpiar_borrador(l_borrador);
    FOR i IN 1 .. l_incomp.COUNT LOOP
        limpiar_fila(l_incomp(i));
    END LOOP;

    abrir_json;
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.CLOSE_OBJECT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
END descartar_borrador;

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
  l_rutas t_rutas := t_rutas('mi-postulacion', 'mi-postulacion/lugares', 'mi-postulacion/firma-documento',
                             'mi-postulacion/documento', 'mi-postulacion/borrador');
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
  publicar('mi-postulacion/firma-documento', 'POST',
           'PKG_POSTULACION_APP_ETHOS.FIRMA_DOCUMENTO(p_token => l_token);', 1);
  publicar('mi-postulacion', 'DELETE',
           'PKG_POSTULACION_APP_ETHOS.ELIMINAR(p_token => l_token);');
  publicar('mi-postulacion/borrador', 'PUT',
           'PKG_POSTULACION_APP_ETHOS.GUARDAR_BORRADOR(p_token => l_token, p_body => :body_text);', 1);
  publicar('mi-postulacion/borrador', 'DELETE',
           'PKG_POSTULACION_APP_ETHOS.DESCARTAR_BORRADOR(p_token => l_token);', 1);
  -- DELETE sin cuerpo (ORDS responde 400 a un DELETE con cuerpo): la url va en el query string.
  publicar('mi-postulacion/documento', 'DELETE',
           'PKG_POSTULACION_APP_ETHOS.QUITAR_DOCUMENTO(p_token => l_token, p_url => :url);', 1);
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('[OK]   Publicados los 8 endpoints de ethos/mi-postulacion.');
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
  DBMS_OUTPUT.PUT_LINE('[INFO] Handlers de mi-postulacion publicados: ' || l_n || ' de 8.');

  -- Documentos: Cloudinary configurado y el secreto a mano (sin mostrarlo).
  IF PKG_CLOUDINARY_ETHOS.falta IS NOT NULL THEN
    DBMS_OUTPUT.PUT_LINE('[WARN] ' || PKG_CLOUDINARY_ETHOS.falta
                         || ': mi-postulacion/firma-documento respondera 503.');
  ELSE
    DECLARE
      l_hay BOOLEAN := FALSE;
    BEGIN
      FOR c IN (SELECT COLUMN_VALUE AS clave FROM TABLE(SYS.ODCIVARCHAR2LIST(
                  'api_secret', 'API_SECRET', 'secreto', 'SECRETO', 'secret', 'SECRET'))) LOOP
        IF PKG_CLOUDINARY_ETHOS.config(c.clave) IS NOT NULL THEN l_hay := TRUE; END IF;
      END LOOP;
      IF l_hay THEN
        DBMS_OUTPUT.PUT_LINE('[OK]   Cloudinary configurado: los facilitadores pueden subir sus documentos (preset fcfacilitadores).');
      ELSE
        DBMS_OUTPUT.PUT_LINE('[WARN] No se encontro el secreto en CLOUDINARY_CONFIG con los nombres conocidos: '
                             || 'pasale a Claude los nombres de las claves de esa tabla (sin los valores).');
      END IF;
    END;
  END IF;

  SELECT COUNT(*) INTO l_n FROM USER_PROCEDURES
   WHERE OBJECT_NAME = 'PKG_CLOUDINARY_ETHOS' AND PROCEDURE_NAME = 'BORRAR';
  IF l_n = 0 THEN
    DBMS_OUTPUT.PUT_LINE('[WARN] PKG_CLOUDINARY_ETHOS no tiene BORRAR: un documento reemplazado queda en Cloudinary.');
  END IF;

  SELECT MIN(ID_ANIO) INTO l_id_anio FROM ANIOS_LECTIVOS
   WHERE TO_CHAR(ANIO) = TO_CHAR(FN_ANIO_LECTIVO_ACTUAL());
  IF l_id_anio IS NULL THEN
    DBMS_OUTPUT.PUT_LINE('[WARN] El año lectivo actual (' || FN_ANIO_LECTIVO_ACTUAL()
                         || ') no esta en ANIOS_LECTIVOS: la app mostrara "no hay postulacion abierta".');
  ELSE
    DBMS_OUTPUT.PUT_LINE('[OK]   Año lectivo ' || FN_ANIO_LECTIVO_ACTUAL()
                         || ' (ID_ANIO ' || l_id_anio || ').');
    IF NVL(FN_POSTULACION_ABIERTA(l_id_anio), 'NO') = 'SI' THEN
      DBMS_OUTPUT.PUT_LINE('[OK]   Periodo de postulacion ABIERTO (FN_POSTULACION_ABIERTA = SI): se puede cargar y modificar.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[WARN] Periodo de postulacion CERRADO o sin cargar en PERIODOS_POSTULACION: '
                           || 'la app muestra la postulacion pero no deja cargar ni modificar.');
    END IF;
  END IF;

  SELECT COUNT(*) INTO l_n FROM DEPARTAMENTOS WHERE ID_PAIS = 1;
  DBMS_OUTPUT.PUT_LINE('[INFO] Departamentos de Paraguay (ID_PAIS 1): ' || l_n || '.');
END;
/
