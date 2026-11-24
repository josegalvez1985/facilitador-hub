---
name: portar-pagina-apex
description: Procedimiento completo para portar una página de la app Oracle APEX 193573 "Facilitadores" a esta app (análisis del export, endpoint ORDS, pantalla, nav, README y manual). Usar cuando el usuario entrega el export de una página APEX o pide modernizar una página de APEX.
---

# Portar una página APEX

Modernización = la misma funcionalidad y la misma semántica de datos que la página APEX, con la interfaz de la app. No es un rediseño libre.

## 0. Preparación
- [ ] `git status`: no pisar cambios locales.
- [ ] Leer `AGENTS.md` (Backend, "Pages done so far") y `sql/README.md`.
- [ ] Tener el export de la página. Si el usuario no lo pasó, pedirlo.
- [ ] Mirar un port anterior parecido como referencia (lista ligera: `mis-materiales` = `sql/materiales_app_ethos.sql` + `src/facilitadores/materiales.ts` + `src/facilitadores/screens/materials.tsx`).

## 1. Análisis (agente `apex-porter`)
Del export extraer, por región y proceso:
- Consulta SQL **literal**, con filtros, joins, `GROUP BY`, `HAVING`, `ORDER BY`.
- Condiciones de despliegue, ítems de página, LOV, validaciones, procesos (qué escriben y dónde).
- Cada `:APP_USER` → en la app se resuelve en el servidor desde el token.
- Fechas convertidas a nombre de día/mes → `NLS_DATE_LANGUAGE=SPANISH` explícito.
- Objetos APEX usados (vistas, funciones, tablas). No se modifican; si hay que adaptarlos, copia `*_APP_ETHOS`.

## 2. Preguntas al usuario (antes de programar)
- Tablas, columnas, código de paquetes o formas de respuesta que no están en `sql/`.
- Diferencias que obligan las reglas de `AGENTS.md` (aislamiento, datos que no se muestran).
- No seguir hasta tener las respuestas que bloquean el diseño.

## 3. Backend (skill `plsql-ords`, agente `backend-developer`)
- ¿Un endpoint `ethos` publicado ya devuelve lo necesario? Reutilizarlo.
- Si no: procedimiento en un paquete `PKG_<AREA>_APP_ETHOS` con su script `sql/<area>_app_ethos.sql`, con la consulta original citada en un comentario (`-- APEX 193573, página N, región "X"`).
- Documentar el endpoint en `sql/README.md`.
- Decirle al usuario: **"hay que ejecutar `sql/<archivo>.sql` en APEX"**. Nunca asumir que se ejecutó.

## 4. Cliente (skill `pantalla-expo`, agente `frontend-developer`)
- Módulo de datos `src/facilitadores/<area>.ts`, pantalla `src/facilitadores/screens/<area>.tsx`, ruta de dos líneas `src/app/(app)/<ruta>.tsx`.
- Entrada en el array `nav` de `src/facilitadores/shell.tsx` (nunca en la barra inferior).

## 5. Documentación
- Fila en la tabla "Modernización de las páginas APEX" de `README.md`: `| N · Nombre | /ruta (menú **Etiqueta**) | endpoints | [sql/archivo.sql](sql/archivo.sql) |`.
- Agregar la página a "Pages done so far" en `AGENTS.md` (en inglés, mismo estilo).
- Manual del usuario (agente `manual-writer`) + `npm run manual`.

## 6. Validación y entrega
- [ ] `npm run typecheck` y `npx eslint <archivos cambiados>`. Tests solo si el usuario los pidió.
- [ ] Revisión del diff (`code-reviewer`).
- [ ] Entrega: qué se portó, diferencias deliberadas con APEX, script SQL pendiente de ejecutar, cómo probarlo a mano, si hace falta APK nuevo.
