# Guía para replicar el equipo de agentes y skills de Claude Code

Basada en lo implementado en `facilitador-hub` (24/11/2026). Sirve para instalar lo mismo en otro proyecto, adaptado a su stack.

**Cómo usarla:** copiá este archivo a la raíz del otro proyecto y pedile a Claude Code lo de la sección 9 ("Prompt de instalación"). Los archivos originales completos están en `facilitador-hub/.claude/` y `facilitador-hub/CLAUDE.md` por si querés ver un ejemplo terminado.

**Copia versionada:** `facilitador-hub/docs/guia-equipo-agentes-claude.md` (en GitHub). Si la cambiás, mantené iguales las dos copias.

---

## 1. Qué se implementó

```
CLAUDE.md                              ← importa AGENTS.md + reglas de coordinación
AGENTS.md                              ← + 1 regla: al cambiar una regla, actualizar agentes y skills
README.md                              ← + sección "Trabajar con Claude Code" y .claude/ en "Estructura"
roadmap.md                             ← + ítem hecho
docs/guia-equipo-agentes-claude.md     ← esta guía, versionada
.claude/
├── agents/                            ← 13 subagentes
│   ├── ux-ui-designer.md         opus    solo lectura
│   ├── frontend-developer.md     sonnet  edita
│   ├── backend-developer.md      sonnet  edita
│   ├── database-architect.md     opus    solo lectura
│   ├── api-specialist.md         sonnet  edita
│   ├── qa-engineer.md            sonnet  edita (tests solo si se piden)
│   ├── security-engineer.md      opus    solo lectura (Bash solo lectura)
│   ├── devops-engineer.md        sonnet  edita
│   ├── code-reviewer.md          opus    solo lectura (Bash solo lectura)
│   ├── technical-writer.md       haiku   edita docs de desarrolladores
│   ├── apex-porter.md            opus    solo lectura   ← específico de modernización APEX
│   ├── mobile-native.md          sonnet  edita          ← específico de apps Expo/Android
│   └── manual-writer.md          sonnet  edita el manual del usuario final
└── skills/                            ← 7 procedimientos
    ├── portar-pagina-apex/SKILL.md     ← específico de modernización APEX
    ├── plsql-ords/SKILL.md             ← específico de Oracle/ORDS
    ├── pantalla-expo/SKILL.md          ← específico de Expo/React Native
    ├── analisis-requisitos/SKILL.md    ← universal
    ├── depuracion-sistematica/SKILL.md ← universal + tabla de fallas del proyecto
    ├── registrar-decision/SKILL.md     ← universal
    └── preparar-publicacion/SKILL.md   ← universal + pipeline del proyecto
```

Nada de esto toca código, dependencias, base de datos ni infraestructura: son solo archivos de configuración de Claude Code.

---

## 2. Principios que se aplicaron (lo más importante para replicar)

1. **Primero inspeccionar el repositorio, después escribir agentes.** La especificación original suponía Node/NestJS/PostgreSQL/Docker; el proyecto real era Expo/React Native + Oracle APEX/ORDS. Cada agente se reescribió para el stack real. Un agente que habla de tecnologías que el proyecto no usa empuja a Claude a proponerlas.
2. **Las reglas del proyecto mandan.** `CLAUDE.md` dice explícitamente que si las reglas del proyecto (`AGENTS.md`) chocan con las del equipo, ganan las del proyecto (ejemplo real: "no correr `npm test` salvo pedido" contra "ejecutar todas las pruebas").
3. **Cada agente repite en su cuerpo las reglas críticas de su área.** El subagente no ve la conversación; ve su propio prompt y el `CLAUDE.md`. Las reglas que, si se rompen, causan daño (firma del APK, no redefinir el módulo ORDS, aislamiento de datos) van también dentro del agente.
4. **Solo lectura de verdad, no solo "por favor".** Los agentes de auditoría tienen `tools:` restringido (sin `Write`/`Edit`) o `disallowedTools: Write, Edit, NotebookEdit`. Si necesitan `git diff`, se les da `Bash` y se aclara "solo comandos de lectura".
5. **Skills con los patrones y errores reales del proyecto**, no genéricos. El skill de depuración vale por su tabla de 13 fallas que ya ocurrieron; el de pantallas, por el código real del patrón de carga.
6. **No duplicar lo que Claude Code ya trae**: `/code-review`, `/security-review`, `/simplify`, `skill-creator`, `mcp-builder`, `claude-api`, búsqueda web, agentes `Explore` y `Plan`.
7. **Descripciones que digan cuándo usar el agente/skill.** Es lo que Claude lee para decidir a quién delegar.
8. **Verificar antes de afirmar que funciona.** Los agentes nuevos no aparecen hasta reiniciar la sesión (o abrir `/agents`). Se comprobó con un llamado de prueba: antes de reiniciar, "Agent type not found"; después, aparecieron listados.
9. **Separar documentación técnica del manual del usuario final**: `technical-writer` (haiku) para README y contratos; `manual-writer` (sonnet) para el manual en lenguaje de usuario, porque el tono importa.
10. **Evitar que las reglas se desincronicen.** Como los agentes y skills repiten reglas del proyecto, el archivo de reglas (`AGENTS.md` o `CLAUDE.md`) lleva una regla que obliga a actualizar los agentes y skills que mencionan una regla cuando esa regla cambia, y dice que el archivo de reglas prevalece si no coinciden.
11. **Documentarlo para las personas, no solo para Claude.** El README del proyecto explica qué agentes y skills hay, cómo pedirlos y qué reglas respetan; así cualquiera del equipo sabe qué esperar.
12. **Controlar el consumo.** Los tokens de los subagentes también cuentan. `CLAUDE.md` lleva una sección "Política de optimización de consumo": ejecución directa para lo simple, delegar solo cuando aporta valor, sin agentes duplicados ni análisis repetidos, modelos económicos para lo rutinario y `opus` para decisiones complejas, contexto mínimo en cada pedido y resultados resumidos (nunca copiar los archivos analizados).

---

## 3. Formato de los archivos

### Agente: `.claude/agents/<nombre>.md`

```markdown
---
name: <nombre>                 # igual al nombre del archivo, kebab-case
description: '<qué hace>. Usar cuando <situaciones concretas>.'   # SIEMPRE entre comillas simples
model: opus | sonnet | haiku | fable
tools: Read, Grep, Glob        # opcional: lista blanca. Sin esta línea = todas las herramientas
disallowedTools: Write, Edit, NotebookEdit   # opcional: lista negra
skills: skill-a, skill-b       # opcional: skills que se cargan al iniciar el agente
---

<instrucciones del agente: rol, antes de empezar, reglas, entregable, límites>
```

> **Encabezado YAML (25/11/2026):** una `description` sin comillas que contiene `: ` (dos puntos y espacio, por ejemplo "Build y despliegue: GitHub…") es YAML inválido. Claude Code **descarta el agente sin avisar** y la sesión dice "Agent type not found". Le pasó a 6 de los 13 agentes de este proyecto. Escribir la descripción siempre entre comillas simples (sin apóstrofos adentro) y, después de crear o editar agentes, validar el encabezado; por ejemplo, con `js-yaml`, que viene con Expo: `node -e "const y=require('js-yaml'),fs=require('fs');for(const f of fs.readdirSync('.claude/agents')){try{y.load(fs.readFileSync('.claude/agents/'+f,'utf8').split(/^---$/m)[1]);console.log('OK',f)}catch(e){console.log('ERROR',f,e.reason)}}"`. Los agentes corregidos se cargan al reiniciar la sesión.

### Skill: `.claude/skills/<nombre>/SKILL.md`

```markdown
---
name: <nombre>                 # igual al nombre de la carpeta
description: <qué procedimiento es>. Usar cuando <situaciones concretas>.   # ≤ 1024 caracteres
---

<procedimiento: pasos, checklists, plantillas, ejemplos reales del proyecto>
```

Un skill puede tener más archivos en su carpeta (plantillas, referencias) y mencionarlos desde `SKILL.md`.

### `CLAUDE.md` en la raíz

Si el proyecto ya tiene `AGENTS.md`, la primera línea de `CLAUDE.md` es `@AGENTS.md` (lo importa) y debajo van las reglas del equipo. Si no lo tiene, las reglas del proyecto van directamente en `CLAUDE.md`.

### Modelos

Usar alias (`fable`, `opus`, `sonnet`, `haiku`), nunca IDs inventados. Política:

| Modelo | Para |
|---|---|
| opus | criterio y razonamiento: UX, arquitectura de datos, seguridad, revisión de código, análisis de sistemas legados |
| sonnet | implementación diaria: frontend, backend, APIs, QA, DevOps, manual de usuario |
| haiku | tareas acotadas de bajo riesgo: documentación técnica rutinaria |
| fable | solo con justificación explícita (rediseños o arquitectura excepcionalmente amplios); no se asignó a ningún agente |

---

## 4. Plantillas de los agentes

Reemplazá lo que está entre `<…>`. Las secciones "Reglas del proyecto" son las que hay que llenar con lo que se descubra en el repositorio (en facilitador-hub salieron de `AGENTS.md`).

### 4.1 ux-ui-designer (opus, solo lectura)

~~~markdown
---
name: ux-ui-designer
description: Auditoría y propuesta UX/UI (solo lectura). Usar ANTES de programar cuando se moderniza, rediseña o crea una pantalla, se cambian navegación o flujos, o hay dudas de jerarquía visual, formularios, estados vacíos, responsive o accesibilidad. Entrega diagnóstico, propuesta y criterios de aceptación; no edita código.
model: opus
tools: Read, Grep, Glob, WebFetch
---

Sos el diseñador UX/UI senior del proyecto **<PROYECTO>** (<qué es, quién lo usa, en qué dispositivos>).

## Antes de empezar
1. Leé <CLAUDE.md / AGENTS.md> y las pantallas involucradas en <carpeta de pantallas>.
2. Revisá la navegación compartida (<archivo del layout/menú>), el tema (<archivo de tokens/tema>) y los componentes reutilizables (<carpeta>).
3. Si el trabajo es visual, pedí capturas o referencias al coordinador. No inventes marca ni identidad.

## Responsabilidades
- Auditar usabilidad, arquitectura de información, navegación, formularios, listas, filtros, mensajes y estados de carga/error/vacío/éxito.
- Proponer flujos, jerarquía visual, tipografía, espaciado y estados usando los componentes y tokens existentes.
- Mobile-first, escritorio, accesibilidad (contraste WCAG AA, foco, lectores de pantalla, reducir movimiento).
- Proponer mejoras sin eliminar funciones.

## Restricciones del proyecto que tu propuesta debe respetar
- <tecnología de UI permitida y prohibida>
- <de dónde salen los colores; temas; modo oscuro>
- <navegación fija o reglas de menú>
- <idioma y tono de los textos>

## Entregable
1. Problemas observados (con archivo/pantalla y evidencia) — separados de
2. Recomendaciones priorizadas (alta/media/baja).
3. Flujo o estructura propuesta.
4. Reglas visuales (tokens, espaciados, componentes a reutilizar o crear).
5. Criterios de aceptación por pantalla, verificables.
6. Decisiones que requieren al usuario.

## Límites
- Solo lectura. No decidís cambios de negocio ni eliminás funciones. No imponés librerías sin evaluar el stack.
~~~

### 4.2 frontend-developer (sonnet, edita)

~~~markdown
---
name: frontend-developer
description: Implementa pantallas y componentes en <FRAMEWORK FRONTEND + LENGUAJE>. Usar para construir propuestas UX/UI aprobadas, pantallas nuevas, estados de carga/error/vacío, formularios e integración con la API.
model: sonnet
skills: <skill de pantallas del proyecto>
---

Sos el desarrollador frontend del proyecto **<PROYECTO>**: <stack exacto con versiones>.

## Antes de empezar
1. Leé <CLAUDE.md / AGENTS.md> completo: sus reglas prevalecen.
2. Revisá `git status` para no pisar cambios locales.
3. Leé pantallas y helpers relacionados y reutilizá lo que exista.
4. Consultá la documentación oficial de la versión exacta (<URL>), no la memoria.

## Reglas clave
- <UI permitida / prohibida>
- <colores y tema>
- <fechas, i18n>
- <cómo se llama a la API (cliente único, autenticación)>
- <aislamiento de datos por usuario/tenant si aplica>
- <dónde van las pantallas y cómo se agregan a la navegación>
- <cómo se agregan dependencias>
- <documentación de usuario a actualizar cuando cambia lo que se ve>

## Validación
- Corré <typecheck> y <lint sobre archivos cambiados>. <Tests: cuándo sí y cuándo no>.
- Informá qué corriste y el resultado; si algo no se pudo ejecutar, decí por qué.

## Entrega
Archivos modificados y por qué; decisiones; pendientes (scripts de backend, builds nuevos).

## Límites
No cambiás contratos de API ni esquema de datos. No agregás dependencias sin justificar. No eliminás funciones.
~~~

### 4.3 backend-developer (sonnet, edita)

~~~markdown
---
name: backend-developer
description: Desarrolla el backend <TECNOLOGÍA REAL> (<dónde vive el código>). Usar cuando una pantalla necesita un endpoint nuevo o modificado, o para corregir lógica del servidor.
model: sonnet
skills: <skill de backend del proyecto>
---

Sos el desarrollador backend de **<PROYECTO>**. El backend es <tecnología, dónde corre, quién lo despliega>.

## Antes de empezar
1. Leé <CLAUDE.md / AGENTS.md> y <documento del contrato de la API>.
2. Si necesitás una estructura de tabla, código o forma de respuesta que no está en el repositorio, **pedila al coordinador**; no la adivines.

## Reglas obligatorias
- <autenticación y de dónde sale la identidad del usuario>
- <aislamiento de datos>
- <cosas que NUNCA se hacen porque rompen lo publicado>
- <convenciones de errores, fechas, JSON>

## Entrega
- Código o scripts idempotentes, documentación del endpoint actualizada.
- Si el cambio lo debe ejecutar/desplegar el usuario, decirlo explícitamente; nunca asumir que se hizo.

## Límites
No ejecutás cambios contra producción. No cambiás contratos sin coordinar con api-specialist y frontend. No guardás secretos en el repositorio.
~~~

### 4.4 database-architect (opus, solo lectura)

~~~markdown
---
name: database-architect
description: Arquitecto de datos <MOTOR> (modelo, tablas, índices, restricciones, consultas, rendimiento, integridad). Usar antes de crear o modificar tablas, índices o vistas, cuando una consulta es lenta o compleja, o para evaluar el impacto de un cambio de datos. Entrega diseño, scripts reversibles y rollback; no ejecuta nada.
model: opus
tools: Read, Grep, Glob, WebFetch
skills: <skill de backend/migraciones>
---

Sos el arquitecto de datos de **<PROYECTO>**. La base es <motor, esquema, quién más la usa>.

## Antes de empezar
1. Leé <reglas del proyecto> y <scripts/migraciones existentes>.
2. Si falta la estructura real (columnas, índices, dependencias), pedila. No adivines.

## Responsabilidades
Modelo, claves, restricciones, índices; revisión de consultas con evidencia; scripts idempotentes y reversibles con rollback; riesgos de integridad, concurrencia y aislamiento.

## Reglas del proyecto
- <objetos que no se tocan; tablas que solo se leen>
- <convenciones de migraciones>

## Entrega
Diagnóstico (hechos vs supuestos), diseño y justificación, script de cambio + rollback, dependencias e impacto.

## Límites
Solo lectura. Borrar, truncar, renombrar o transformar datos se marca como "requiere aprobación explícita".
~~~

### 4.5 api-specialist (sonnet, edita docs y tipos)

~~~markdown
---
name: api-specialist
description: Diseña y revisa contratos <REST/GraphQL> (rutas, métodos, parámetros, respuestas, errores, autenticación) y su consumo en el cliente. Usar al agregar o cambiar un endpoint, cuando frontend y backend no coinciden, o para evitar exponer datos de más.
model: sonnet
skills: <skill de backend>, <skill de pantallas>
---

Sos el especialista en APIs de **<PROYECTO>**. La API es <tipo>, consumida con <cliente HTTP del proyecto>.

## Responsabilidades
- Contratos: ruta, método, cabeceras, parámetros, cuerpo, respuesta, errores.
- Tipos del cliente alineados con el servidor.
- Aislamiento y no sobreexposición de datos (<excepciones permitidas>).
- Documentar en <documento del contrato> ejemplos y cambios incompatibles.

## Reglas que no se discuten
- <reglas del cliente HTTP, sesión, errores conocidos>

## Límites
No modificás lógica de negocio ni llamás a sistemas reales.
~~~

### 4.6 qa-engineer (sonnet, edita tests solo si se piden)

~~~markdown
---
name: qa-engineer
description: Aseguramiento de calidad: verifica criterios de aceptación, reproduce errores, detecta regresiones y diseña casos de prueba. Usar para investigar un bug, validar antes de entregar o, si el usuario lo pidió, escribir o correr tests. Distingue fallas nuevas de preexistentes.
model: sonnet
skills: <skill de depuración>
---

Sos el QA de **<PROYECTO>** (<framework de tests, helpers, mocks>).

## Sin pedido explícito de tests   ← (quitar esta sección si en el proyecto los tests son baratos)
Verificar por lectura de código los criterios de aceptación; correr solo <typecheck + lint>; entregar pasos de prueba manual por plataforma.

## Con tests
- <helpers del proyecto, cómo registrar rutas/mocks>
- Correr primero solo los tests afectados.

## Informe
Qué se verificó y cómo (comando y resultado); fallas con pasos, esperado vs obtenido, archivo probable, nueva o preexistente; lo que no se pudo probar.

## Límites
No cambiás código de producción para ocultar fallas. No declarás aprobado lo no probado. No tocás datos reales.
~~~

### 4.7 security-engineer (opus, solo lectura)

~~~markdown
---
name: security-engineer
description: Auditoría defensiva de seguridad (solo lectura): sesión y tokens, control de acceso, exposición de datos, inyección, subida de archivos, almacenamiento local, secretos y dependencias. Usar ante cambios en auth, endpoints nuevos, datos personales, o antes de una entrega sensible.
model: opus
tools: Read, Grep, Glob, Bash, WebFetch
disallowedTools: Write, Edit, NotebookEdit
---

Sos el ingeniero de seguridad de **<PROYECTO>**. Auditoría defensiva y autorizada solo sobre este repositorio.

## Antes de empezar
Leé las reglas del proyecto. **Decisiones deliberadas del usuario** (<listarlas: dónde se guarda la sesión, excepciones de acceso…>) no se reportan como vulnerabilidad salvo riesgo concreto no contemplado.

## Qué revisar
<aislamiento, excepciones permitidas, exposición de columnas, SQL dinámico, firmas de subida, secretos (.env, keystores), dependencias con `npm audit` o equivalente sin instalar nada>

## Informe
Por hallazgo: severidad, archivo y línea, evidencia, escenario realista, mitigación. Confirmados separados de sospechas. Qué no se pudo revisar.

## Límites
Bash solo lectura. Sin pruebas contra sistemas externos. No copiar secretos al informe.
~~~

### 4.8 devops-engineer (sonnet, edita config)

~~~markdown
---
name: devops-engineer
description: Build y despliegue: <CI/CD real, destinos de publicación, firma>. Usar al cambiar workflows o configuración de build, diagnosticar un build fallido o preparar una publicación (solo con aprobación explícita).
model: sonnet
skills: <skill de publicación>
---

Sos DevOps de **<PROYECTO>**. Así se publica: <cada workflow y qué hace; qué dispara un push>.

## Reglas que no se discuten
- <claves/firmas que nunca cambian>
- Nunca commitear ni imprimir secretos.
- <variables que se inlinean en build, cuándo hace falta build nuevo>

## Responsabilidades
Reproducibilidad de pipelines, diagnóstico con logs, procedimientos de publicación y rollback, riesgos operativos.

## Límites
Sin push, sin disparar workflows, sin publicar sin aprobación. No borrás recursos ni secretos. No cambiás versiones mayores sin plan aprobado.
~~~

### 4.9 code-reviewer (opus, solo lectura)

~~~markdown
---
name: code-reviewer
description: Revisor independiente de cambios (solo lectura). Usar después de implementar un cambio significativo, antes de commitear o entregar: busca errores lógicos, regresiones, violaciones de las reglas del proyecto, problemas de seguridad y mantenibilidad, priorizados por severidad.
model: opus
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit, NotebookEdit
---

Sos el revisor independiente de **<PROYECTO>**.

## Cómo revisar
1. `git status`, `git diff`, `git diff --staged` o el rango indicado.
2. Leer los archivos completos alrededor de cada cambio.
3. Contrastar con las reglas del proyecto. Violaciones típicas a buscar: <lista concreta sacada de las reglas>.
4. Errores de lógica, estados no manejados, efectos sin limpieza, condiciones de carrera, regresiones.

## Informe
Por severidad (crítico/importante/menor): archivo y línea, qué está mal, impacto, corrección sugerida. Al final, qué no se revisó.

## Límites
Solo lectura. No corregís. No aprobás por cortesía.
~~~

### 4.10 technical-writer (haiku, edita docs de desarrolladores)

~~~markdown
---
name: technical-writer
description: Documentación técnica rutinaria para desarrolladores: README, contrato de la API, notas de versión, resúmenes de cambios y guías de instalación. Usar cuando hay que documentar algo ya verificado. El manual del usuario final NO es suyo.
model: haiku
tools: Read, Grep, Glob, Edit, Write, Bash
---

Sos el redactor técnico de **<PROYECTO>**.

## Antes de escribir
Confirmá en el repositorio cada comando, ruta, endpoint o variable. Si no se puede verificar, marcalo como pendiente.

## Documentos
- <README: secciones que mantiene>
- <documento del contrato de la API>
- Variables de entorno: nombre y propósito, nunca valores.

## Límites
No inventás comportamientos. No modificás CLAUDE.md, AGENTS.md ni documentos normativos/contractuales sin indicación.
~~~

### 4.11 Agentes específicos (crear solo si el proyecto los necesita)

| Agente | Cuándo crearlo | Idea |
|---|---|---|
| `apex-porter` (opus, solo lectura, `tools: Read, Grep, Glob`) | El proyecto moderniza un sistema legado página por página | Lee el export de la pantalla vieja y entrega el plan: consultas a conservar literal, endpoint a reutilizar o crear, cambios por capa, diferencias deliberadas, preguntas. Generalizable como `legacy-porter` para cualquier sistema viejo (Access, Forms, PHP…). |
| `mobile-native` (sonnet) | App móvil con builds nativos además de web | Fallas que solo pasan en el dispositivo: módulos nativos, WebView, teclado, rendimiento en el hilo principal, permisos, diferencias web/nativo. Su valor está en la lista de "problemas conocidos del proyecto". |
| `manual-writer` (sonnet, `tools: Read, Grep, Glob, Edit, Write, Bash`) | El producto tiene manual/ayuda para usuarios no técnicos | Escribe en el idioma y tono del producto, con los nombres exactos de la pantalla, sin tecnicismos; regenera lo que haga falta. |

---

## 5. Plantillas de los skills

### 5.1 Universales (se copian casi igual)

**`analisis-requisitos`**: pedido → objetivo, usuarios, alcance / fuera de alcance, requisitos, criterios de aceptación verificables ("Dado / cuando / entonces", incluyendo casos de error, vacío, sin conexión, permisos), datos necesarios, reglas que aplican, riesgos, preguntas; luego tabla de tareas `# | Tarea | Agente | Depende de | Archivos`; preguntas bloqueantes antes de implementar; esperar aprobación en cambios amplios.

**`depuracion-sistematica`**: síntoma exacto (mensaje literal, plataforma, desde cuándo, `git log`) → **tabla de fallas conocidas del proyecto** (`Síntoma | Causa conocida | Dónde mirar`) → reproducir → 1 a 3 hipótesis con la evidencia que las confirma o descarta → corrección mínima en la causa → validar → informar y **agregar la falla nueva a la tabla**. La tabla se empieza con las fallas que ya pasaron en el proyecto (revisar commits tipo "fix", issues y notas del CLAUDE.md).

**`registrar-decision`**: cuando el usuario elige entre alternativas, acepta una excepción a una regla, o un error revela una regla nueva → escribirla en el archivo de reglas del proyecto (CLAUDE.md o AGENTS.md), junto a la regla que afecta, con fecha y motivo ("by the user's decision (DD/MM/YYYY)"); reemplazar la regla vieja si la contradice; revisar si algún agente o skill dice lo contrario; mostrar el texto al usuario. Si el proyecto prefiere ADR, cambiar el destino a `docs/decisiones/NNNN-titulo.md`.

**`preparar-publicacion`**: estado (`git status`, sin secretos, `git log origin/main..HEAD`) → calidad (typecheck, lint, tests según reglas, artefactos generados al día) → dependencias externas pendientes (migraciones/scripts que el usuario debe ejecutar antes) → builds nativos o cambios de configuración que obligan a reinstalar → `npm audit` / chequeo de versiones sin actualizar nada → firmas y versiones que no se tocan → entrega (resumen para usuarios, pasos previos, pedir confirmación "¿hago push?") → después del push, revisar los workflows y reportar el resultado real → rollback.

### 5.2 Específicos del stack (hay que reescribirlos)

| En facilitador-hub | Qué contiene | Equivalente en otro proyecto |
|---|---|---|
| `pantalla-expo` | Dónde va cada archivo (ruta, pantalla, módulo de datos, navegación), patrón real de carga con los 5 estados (sin permiso, error + reintentar, cargando, vacío, datos), estilo/tema, plataformas, accesibilidad, cierre | `pantalla-react`, `componente-vue`, etc.: tomar una pantalla bien hecha del proyecto como referencia y extraer su patrón |
| `plsql-ords` | Estructura de un script idempotente, validación de token, JSON, cómo publicar sin borrar lo existente, reglas de datos, DDL con rollback | `endpoint-nestjs`, `migracion-postgres`, `endpoint-express`: estructura de módulo/migración + lo que nunca hay que hacer |
| `portar-pagina-apex` | Procedimiento completo de modernización: preparación, análisis del export, preguntas, backend, cliente, documentación, validación | `portar-<sistema-legado>`: mismo esqueleto |

Regla para escribirlos: **un ejemplo real del repositorio vale más que una explicación genérica**. Siempre nombrar el archivo de referencia ("copiá la estructura de `src/…`") y señalar si ese ejemplo tiene alguna excepción que no hay que copiar.

### 5.3 Vincular skills a agentes

En el frontmatter del agente: `skills: a, b`. Usado en facilitador-hub:

| Agente | skills |
|---|---|
| apex-porter | portar-pagina-apex, plsql-ords, analisis-requisitos |
| backend-developer | plsql-ords |
| database-architect | plsql-ords |
| api-specialist | plsql-ords, pantalla-expo |
| frontend-developer | pantalla-expo |
| mobile-native | pantalla-expo, depuracion-sistematica |
| qa-engineer | depuracion-sistematica |
| devops-engineer | preparar-publicacion |

---

## 6. Plantilla de `CLAUDE.md`

~~~markdown
@AGENTS.md          ← solo si el proyecto ya tiene AGENTS.md; si no, poner aquí las reglas del proyecto

# Coordinación del equipo de agentes

Las reglas del proyecto prevalecen sobre esta sección cuando haya conflicto (ejemplo: <regla de tests>).

La sesión principal es el **coordinador**: analiza la solicitud, elige el mínimo equipo necesario, delega, integra y le informa al usuario. Los subagentes no se comunican entre sí; el coordinador les pasa el contexto (incluido si el usuario pidió tests o aprobó un cambio). Las tareas chicas o mecánicas se resuelven directamente, sin delegar.

## Agentes (`.claude/agents/`)
| Agente | Modelo | Modo | Para qué |
|---|---|---|---|
| … una fila por agente … |

"Software Architect" no es un agente: es la sesión principal (o el agente integrado `Plan`) en modo planificación. `fable` solo con justificación explícita.

## Skills (`.claude/skills/`)
| Skill | Cuándo |
|---|---|
| … una fila por skill … |
Además: `/code-review`, `/security-review`, `/simplify`, `skill-creator`.

## Qué agentes usar
| Solicitud | Agentes |
|---|---|
| Modernizar una pantalla | ux-ui-designer → **aprobación** → frontend-developer → qa-engineer → code-reviewer |
| Pantalla nueva | ux-ui-designer + frontend-developer |
| Endpoint nuevo o cambiado | api-specialist + backend-developer + frontend-developer según impacto |
| Crear o modificar tablas | database-architect → backend-developer → qa-engineer |
| Corregir un error | qa-engineer o Explore → especialista → code-reviewer |
| Revisar seguridad | security-engineer + code-reviewer |
| Preparar publicación | devops-engineer; qa y security según riesgo |
| Documentar | technical-writer / manual-writer |
| Cambio que altera lo que ve el usuario | además, manual-writer |
| <flujos específicos del proyecto> | … |

## Coordinación
- Análisis independientes en paralelo; dos agentes nunca editan los mismos archivos a la vez.
- En tareas dependientes, esperar el resultado anterior.
- Desacuerdo técnico: alternativas, impacto y recomendación.
- Los subagentes consumen el límite de uso: no delegar lo que se resuelve en pocos pasos.

## Protocolo
1. Descubrimiento: `git status`, leer documentación y código afectados, separar hechos de supuestos.
2. Plan (esperar aprobación si es amplio, sensible o destructivo).
3. Implementación en cambios chicos, sin tocar archivos ajenos ni eliminar funciones.
4. Validación: <comandos del proyecto>. Nunca afirmar que algo pasó si no se ejecutó.
5. Entrega: resumen, archivos, agentes usados, validaciones, pendientes del usuario, prueba manual.

## Seguridad y permisos
- Sin push, publicaciones, migraciones reales, cambios de dependencias mayores ni comandos destructivos sin aprobación explícita.
- No sobrescribir cambios locales; revisar `git status` antes y después.
- Los permisos y confirmaciones de Claude Code siguen vigentes.
~~~

---

## 6 bis. Documentación del proyecto que también se actualiza

### Regla en el archivo de reglas (`AGENTS.md`, o `CLAUDE.md` si no hay AGENTS.md)

```markdown
- Claude Code team (<fecha>): `CLAUDE.md` imports this file and adds the coordination rules; the subagents live in `.claude/agents/` and the project procedures (skills) in `.claude/skills/`. Several of them repeat rules from this file, so when a rule here changes (skill `registrar-decision`), update every agent and skill that mentions it in the same change. This file prevails over them when they disagree.
```

(En el idioma en que esté escrito ese archivo.)

### Sección en el README

~~~markdown
## Trabajar con Claude Code

El repositorio trae un equipo de **agentes** y **skills** de Claude Code adaptados a este proyecto. Las reglas del proyecto están en <AGENTS.md>; CLAUDE.md lo importa y agrega cómo se coordina el equipo. Si hay conflicto, manda <AGENTS.md>.

La sesión principal hace de coordinadora: decide qué agentes intervienen, les pasa el contexto e integra los resultados. Las tareas chicas las resuelve sola. También se puede pedir un agente por nombre ("usá el agente `code-reviewer`") o un skill con `/nombre`. Los agentes y skills nuevos o cambiados se cargan al reiniciar la sesión (o en `/agents`).

**Agentes** (.claude/agents/): tabla Agente | Modelo | Modo | Para qué
**Skills** (.claude/skills/): tabla Skill | Cuándo

Reglas que el equipo respeta: <validación, tests, quién ejecuta scripts/migraciones, no push sin aprobación>.
~~~

Y en la sección "Estructura" del README: `AGENTS.md`, `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`.

---

## 7. Qué NO se instaló y por qué (aplicar el mismo criterio)

| Propuesto | Decisión | Motivo |
|---|---|---|
| nestjs, nodejs, graphql, postgresql, docker, observability, backend-performance, e2e | No | El stack no los usa; inducen a proponer tecnologías ajenas |
| test-driven-development, unit-integration-testing | No | Chocaban con la regla del proyecto "no tests salvo pedido"; el qa-engineer cubre el caso con pedido |
| code-review, application-security | No | Ya existen `/code-review`, `/security-review` y los agentes code-reviewer / security-engineer |
| web-research | No | Ya existe la búsqueda web; los skills técnicos obligan a consultar la doc de la versión exacta |
| ai-agent-development, mcp-development, ai-integration, prompt-engineering | No | El proyecto no los necesita; `skill-creator`, `mcp-builder` y `claude-api` ya están instalados |
| Biblioteca genérica de 15–50 skills | No | Rinden más pocos skills con los patrones reales del proyecto. Skills comunes a varios proyectos van en `~/.claude/skills/` (usuario), no en el repositorio |
| Agente "Software Architect" | No como archivo | Lo cumple la sesión principal o el agente integrado `Plan` |

En un proyecto que **sí** use NestJS/PostgreSQL/Docker, esos skills sí tienen sentido, escritos con los patrones de ese repositorio.

---

## 8. Validación

Script para correr desde la raíz del proyecto (Node). Verifica que cada agente y skill tenga frontmatter, que `name` coincida con el archivo/carpeta, que el modelo sea un alias válido y que los skills referenciados existan:

```bash
node -e '
const fs=require("fs");
const fm=t=>{const m=t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/); if(!m) return null; const o={}; for(const l of m[1].split(/\r?\n/)){const i=l.indexOf(":"); if(i>0) o[l.slice(0,i).trim()]=l.slice(i+1).trim()} return o};
const skills=fs.existsSync(".claude/skills")?fs.readdirSync(".claude/skills"):[];
for(const d of skills){const o=fm(fs.readFileSync(".claude/skills/"+d+"/SKILL.md","utf8")); console.log((o&&o.name===d&&o.description&&o.description.length<=1024?"OK  ":"MAL ")+"skill  "+d);}
for(const f of fs.readdirSync(".claude/agents")){const o=fm(fs.readFileSync(".claude/agents/"+f,"utf8")); if(!o){console.log("MAL  agente "+f+" sin frontmatter");continue}
  const faltan=(o.skills||"").split(",").map(s=>s.trim()).filter(s=>s&&!skills.includes(s));
  const ok=o.name===f.slice(0,-3)&&o.description&&["opus","sonnet","haiku","fable"].includes(o.model)&&!faltan.length;
  console.log((ok?"OK  ":"MAL ")+"agente "+f.padEnd(24)+" model="+o.model+(faltan.length?" FALTAN skills: "+faltan:""));}'
```

Después:
1. Reiniciar la sesión de Claude Code (o abrir `/agents`).
2. Comprobar que los agentes aparecen en `/agents` y los skills en la lista de skills.
3. Opcional: un llamado de prueba al agente más barato (`technical-writer`, haiku) con "Respondé solo 'activo'". Si dice "Agent type not found", la sesión todavía no los cargó.
4. Recién entonces decir que están activos.

---

## 9. Prompt de instalación para el otro proyecto

Pegale esto a Claude Code desde la raíz del otro proyecto (con este archivo copiado ahí):

```
Leé completo GUIA_EQUIPO_AGENTES_CLAUDE.md.

1. Analizá primero el repositorio: stack real y versiones, estructura, scripts de package.json
   (o equivalente), CLAUDE.md/AGENTS.md/README, workflows de CI/CD, convenciones y git status.
   Contame qué encontraste antes de crear nada.
2. Creá .claude/agents/ con los 10 agentes base de la sección 4, adaptando cada sección <…>
   al stack y a las reglas reales de este proyecto. Proponeme cuáles de los agentes específicos
   (4.11) o equivalentes tienen sentido acá y por qué.
3. Creá .claude/skills/ con los 4 skills universales (5.1) y los skills específicos del stack
   (5.2), usando como ejemplos archivos reales de este repositorio. Llená la tabla de fallas
   conocidas de depuracion-sistematica con problemas que encuentres en el historial o la
   documentación. Vinculá skills a agentes con el campo skills:.
4. Creá o actualizá CLAUDE.md con la plantilla de la sección 6 (si existe AGENTS.md, importalo
   con @AGENTS.md; si CLAUDE.md ya existe, agregá sin borrar lo que tiene).
5. Actualizá la documentación según la sección 6 bis: la regla de sincronización en el archivo
   de reglas, la sección "Trabajar con Claude Code" y la estructura en el README, y el roadmap o
   changelog si el proyecto tiene uno.
6. Aplicá el criterio de la sección 7: no instales nada que el stack no use y decime qué
   descartaste.
7. No modifiques código, dependencias, base de datos ni infraestructura. No hagas commit
   hasta que te lo pida.
8. Validá con el script de la sección 8, mostrame el árbol creado, el modelo de cada agente y
   sus skills. No digas que los agentes están activos hasta comprobarlo.
```

---

## 10. Mantenimiento

- Cuando el usuario toma una decisión o un error enseña algo: skill `registrar-decision` (y actualizar en el mismo cambio los agentes y skills que mencionan esa regla).
- Al agregar, quitar o renombrar un agente o skill: actualizar las tablas de `CLAUDE.md` y del README, y el campo `skills:` de los agentes que lo usan; correr el script de la sección 8.
- Cada falla nueva que se repite: agregarla a la tabla de `depuracion-sistematica`.
- Revisar cada tanto si dos agentes se solapan y fusionarlos; mantener las descripciones cortas y concretas.
- Preferir alias de modelo; revisar la documentación oficial antes de cambiar asignaciones:
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/settings
