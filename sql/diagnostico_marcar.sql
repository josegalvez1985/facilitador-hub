--------------------------------------------------------------------------------
-- Diagnóstico de "Marcar" (página 2 de APEX 193573, Intervención)
--
-- Explica por qué una institución NO aparece en el select "Institución".
-- Solo lectura: no modifica nada.
--
-- Correr en APEX → SQL Workshop → SQL Commands. Pide :USUARIO (ej. TWALDE).
--
-- La lista de la página (LOV de P2_ID_INSTITUCION, igual en
-- PKG_INTERVENCIONES_APP_ETHOS.INICIO) muestra una institución si ALGUNA de sus
-- postulaciones cumple todo esto:
--   1. NVL(ESTADO,'Activo') = 'Activo'
--   2. ANIO = FN_ANIO_LECTIVO_ACTUAL()
--   3. NVL(ESTADO_INSTITUCION,'I') = 'A'
--   4. Sin intervenciones desde TRUNC(SYSDATE - 6) hasta hoy (incluido)
--------------------------------------------------------------------------------

-- 1) ¿El usuario está en FACILITADORES? (0 filas = no es facilitador; 2 o más = duplicado)
SELECT id_facilitador, usuario, ind_ubicacion_postulacion
  FROM facilitadores
 WHERE UPPER(TRIM(usuario)) = UPPER(TRIM(:USUARIO));

-- 2) Cada postulación del usuario y el primer filtro que la deja afuera.
SELECT a.id_postulacion,
       a.id_institucion,
       a.nombre,
       a.anio,
       FN_ANIO_LECTIVO_ACTUAL()          AS anio_actual,
       NVL(a.estado, 'Activo')           AS estado_postulacion,
       NVL(a.estado_institucion, 'I')    AS estado_institucion,
       (SELECT MAX(b.fecha_hora) FROM intervenciones b WHERE b.id_postulacion = a.id_postulacion) AS ultima_intervencion,
       TRUNC(SYSDATE - 6)                AS ventana_desde,
       SYSDATE                           AS ahora_servidor,
       CASE
         WHEN NVL(a.estado, 'Activo') <> 'Activo' THEN 'NO: postulación no activa (ESTADO)'
         WHEN a.anio <> FN_ANIO_LECTIVO_ACTUAL() THEN 'NO: otro año lectivo (ANIO)'
         WHEN NVL(a.estado_institucion, 'I') <> 'A' THEN 'NO: institución no activa (ESTADO_INSTITUCION)'
         WHEN EXISTS (SELECT 1 FROM intervenciones b
                       WHERE b.id_postulacion = a.id_postulacion
                         AND b.fecha_hora >= TRUNC(SYSDATE - 6)
                         AND b.fecha_hora < TRUNC(SYSDATE + 1)) THEN 'NO: ya marcada en los últimos 7 días'
         ELSE 'SÍ: aparece en Marcar'
       END AS resultado
  FROM facilitadores f
  JOIN v_instituciones a ON a.id_facilitador = f.id_facilitador
 WHERE UPPER(TRIM(f.usuario)) = UPPER(TRIM(:USUARIO))
 ORDER BY a.nombre, a.id_postulacion;

-- 4) EXACTAMENTE lo que ve Marcar ahora: LOV de P2_ID_INSTITUCION y, por institución,
--    el LOV de P2_ID_POSTULACION ("Horario"). Es el mismo SQL de la página 2 y de
--    PKG_INTERVENCIONES_APP_ETHOS.INICIO / HORARIOS. Si esto da filas y la app no
--    muestra la institución, el problema está en la app o en el paquete publicado.
SELECT i.id_institucion,
       i.nombre,
       TO_CHAR(h.hora_desde, 'hh24:mi') || '-' || TO_CHAR(h.hora_hasta, 'hh24:mi') AS horario,
       h.id_postulacion
  FROM (SELECT DISTINCT a.nombre, a.id_institucion, a.id_facilitador
          FROM v_instituciones a
         WHERE a.id_facilitador = (SELECT id_facilitador FROM facilitadores WHERE UPPER(TRIM(usuario)) = UPPER(TRIM(:USUARIO)))
           AND NVL(a.estado, 'Activo') = 'Activo'
           AND a.anio = FN_ANIO_LECTIVO_ACTUAL()
           AND NVL(a.estado_institucion, 'I') = 'A'
           AND NOT EXISTS (SELECT 1 FROM intervenciones b
                            WHERE b.id_postulacion = a.id_postulacion
                              AND b.fecha_hora >= TRUNC(SYSDATE - 6)
                              AND b.fecha_hora < TRUNC(SYSDATE + 1))) i
  LEFT JOIN v_instituciones h
         ON h.id_institucion = i.id_institucion
        AND h.id_facilitador = i.id_facilitador
        AND NVL(h.estado, 'Activo') = 'Activo'
        AND h.anio = FN_ANIO_LECTIVO_ACTUAL()
        AND NOT EXISTS (SELECT 1 FROM intervenciones b
                         WHERE TRUNC(b.fecha_hora) = TRUNC(SYSDATE)
                           AND b.id_postulacion = h.id_postulacion)
 ORDER BY i.nombre, horario;

-- 3) Solo el año lectivo actual, con la fecha en que cada postulación vuelve a aparecer.
SELECT a.id_postulacion,
       a.nombre,
       NVL(a.estado, 'Activo')        AS estado_postulacion,
       NVL(a.estado_institucion, 'I') AS estado_institucion,
       u.ultima                       AS ultima_intervencion,
       CASE WHEN u.ultima >= TRUNC(SYSDATE - 6) THEN TRUNC(u.ultima) + 7 END AS vuelve_a_aparecer
  FROM facilitadores f
  JOIN v_instituciones a ON a.id_facilitador = f.id_facilitador
  LEFT JOIN (SELECT id_postulacion, MAX(fecha_hora) ultima FROM intervenciones GROUP BY id_postulacion) u
         ON u.id_postulacion = a.id_postulacion
 WHERE UPPER(TRIM(f.usuario)) = UPPER(TRIM(:USUARIO))
   AND a.anio = FN_ANIO_LECTIVO_ACTUAL()
 ORDER BY a.nombre, a.id_postulacion;
