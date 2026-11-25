@AGENTS.md

# Coordinación del equipo de agentes

Las reglas de `AGENTS.md` (importado arriba) son las del proyecto y **prevalecen** sobre esta sección cuando haya conflicto (por ejemplo: no correr `npm test` ni escribir tests salvo pedido explícito).

La sesión principal es el **coordinador**: analiza la solicitud, elige el mínimo equipo necesario, delega, integra los resultados y le informa al usuario. Los subagentes no se comunican entre sí; el coordinador les pasa el contexto que necesitan (incluido si el usuario pidió tests o aprobó un cambio). Las tareas chicas o mecánicas se resuelven directamente, sin delegar.

## Agentes (`.claude/agents/`)

| Agente | Modelo | Modo | Para qué |
|---|---|---|---|
| `ux-ui-designer` | opus | solo lectura | Auditoría y propuesta UX/UI, flujos, criterios de aceptación |
| `frontend-developer` | sonnet | edita | Pantallas y componentes Expo / React Native |
| `backend-developer` | sonnet | edita | Paquetes PL/SQL `PKG_*_APP_ETHOS` y handlers ORDS en `sql/` |
| `database-architect` | opus | solo lectura | Modelo Oracle, tablas, índices, consultas, rollback |
| `api-specialist` | sonnet | edita docs/tipos | Contratos REST del módulo `ethos` y su consumo |
| `qa-engineer` | sonnet | edita tests solo si se pidieron | Criterios de aceptación, bugs, regresiones |
| `security-engineer` | opus | solo lectura | Sesión, aislamiento, exposición de datos, secretos |
| `devops-engineer` | sonnet | edita config | Workflows, EAS, Pages, APK/AAB |
| `code-reviewer` | opus | solo lectura | Revisión independiente del diff |
| `technical-writer` | haiku | edita docs | README, `sql/README.md`, notas de versión |
| `apex-porter` | opus | solo lectura | Analiza el export de una página APEX y arma el plan de port |
| `mobile-native` | sonnet | edita | Fallas solo de Android: módulos nativos, WebView, teclado, rendimiento |
| `manual-writer` | sonnet | edita el manual | `docs/manual-usuario.md` para facilitadores + `npm run manual` |

## Skills (`.claude/skills/`)

Procedimientos que usan tanto la sesión principal como los agentes (los que figuran en `skills:` de cada agente se le cargan al iniciar).

| Skill | Cuándo |
|---|---|
| `portar-pagina-apex` | El usuario entrega una página APEX para modernizar |
| `plsql-ords` | Crear o modificar scripts de `sql/` o endpoints ORDS |
| `pantalla-expo` | Crear o cambiar pantallas y componentes de `src/` |
| `analisis-requisitos` | Pedidos amplios o ambiguos, antes de implementar |
| `depuracion-sistematica` | Algo falla, no carga, se congela o difiere entre Android y web |
| `registrar-decision` | El usuario decide algo o un error revela una regla nueva → `AGENTS.md` |
| `preparar-publicacion` | Antes de push a `main` / APK nuevo (no publica solo) |

Además están los skills integrados de Claude Code: `/code-review`, `/security-review`, `/simplify`; y para crear o mejorar skills, `skill-creator`.

"Software Architect" no es un agente: es la sesión principal (o el agente integrado `Plan`) en modo planificación. `fable` se reserva para rediseños o decisiones de arquitectura excepcionalmente amplias, con justificación explícita.

## Qué agentes usar

| Solicitud | Agentes |
|---|---|
| Portar una página APEX | `apex-porter` → (preguntas al usuario) → `database-architect` si hay tablas nuevas → `backend-developer` → `frontend-developer` → `manual-writer` → `code-reviewer` |
| Falla solo en el APK / módulo nativo nuevo | `mobile-native` → `code-reviewer` |
| Cambio que altera lo que ve o hace el usuario | además, `manual-writer` |
| Modernizar una pantalla existente | `ux-ui-designer` → **aprobación del usuario** → `frontend-developer` → `qa-engineer` → `code-reviewer` |
| Pantalla nueva | `ux-ui-designer` + `frontend-developer` |
| Rediseñar navegación o flujos | `ux-ui-designer`; planificación en la sesión principal si afecta la estructura |
| Endpoint nuevo o cambiado | `api-specialist` + `backend-developer` + `frontend-developer` según impacto |
| Crear o modificar tablas | `database-architect` → `backend-developer` → `qa-engineer` |
| Corregir un error | `qa-engineer` o `Explore` para investigar → especialista responsable → `code-reviewer` |
| Revisar seguridad | `security-engineer` + `code-reviewer` |
| Preparar publicación | `devops-engineer`; `qa-engineer` y `security-engineer` según riesgo |
| Documentar | `technical-writer` (desarrolladores) o `manual-writer` (facilitadores), con datos verificados por el especialista |

## Coordinación
- Análisis independientes pueden ir en paralelo; dos agentes nunca editan los mismos archivos a la vez.
- En tareas dependientes, esperar el resultado anterior antes de delegar la implementación.
- Si hay desacuerdo técnico, presentar alternativas, impacto y recomendación; no ocultarlo.

## Política de optimización de consumo
Los subagentes trabajan en un contexto propio y devuelven solo un resumen, lo que ahorra contexto en la conversación principal, pero sus tokens también consumen el límite de uso. El objetivo no es tener muchos agentes trabajando a la vez, sino el agente correcto, con el modelo adecuado y el mínimo contexto necesario.

- **Ejecución directa primero**: las tareas simples o mecánicas (pocos pasos, un archivo, un dato) las resuelve la sesión principal, sin convocar agentes.
- **Delegar solo cuando aporta valor**: especialización real, contexto independiente (investigar muchos archivos y traer solo la conclusión) o trabajo en paralelo que lo justifique.
- **Sin agentes duplicados**: nunca dos o más agentes investigando lo mismo. Si un análisis ya se hizo en la conversación, se reutiliza; no se repite.
- **Modelo según la tarea**: modelos económicos (`haiku`, `sonnet`) para lo rutinario; `opus` reservado para decisiones complejas y auditorías importantes (seguridad, revisión de cambios sensibles, análisis de páginas APEX); `fable`, como se indicó arriba.
- **Contexto mínimo**: el pedido al subagente indica los archivos relevantes y lo que ya se sabe, para que no vuelva a explorar todo el repositorio. No cargar skills que la tarea no necesita.
- **Resultados resumidos**: pedir a cada subagente hallazgos, cambios hechos (archivos y líneas) y pendientes, en forma concisa; nunca que copie el contenido de los archivos que analizó.
- **Paralelo con criterio**: agentes en paralelo aceleran, pero suman consumo; usarlos solo cuando las tareas son realmente independientes.

## Protocolo
1. **Descubrimiento**: `git status`, leer la documentación y el código afectados, separar hechos de supuestos.
2. **Plan** (para cambios amplios, sensibles o destructivos, esperar aprobación): objetivo, diagnóstico, agentes y motivo, archivos afectados, riesgos, validación prevista, dudas para el usuario.
3. **Implementación**: cambios chicos y coherentes, sin tocar archivos ajenos a la tarea ni eliminar funciones.
4. **Validación**: `npm run typecheck` y `npx eslint <archivos cambiados>`; tests solo si el usuario los pidió. Nunca afirmar que algo pasó si no se ejecutó.
5. **Entrega**: resumen, archivos, agentes usados, validaciones y resultados, scripts de backend que el usuario debe correr en APEX, APK nuevo si hace falta, pasos de prueba manual.

## Modernización de pantallas
No empezar programando: auditoría UX → propuesta con criterios de aceptación → aprobación del usuario → implementación por módulos → verificación → revisión del diff. Mobile-first real, estados de carga/error/vacío/éxito, contraste y foco adecuados, sin textos ni datos de ejemplo presentados como reales.

## Seguridad y permisos
- Nada de `git push`, publicaciones, ejecución de scripts contra el backend real, cambios de dependencias mayores ni comandos destructivos sin aprobación explícita.
- No sobrescribir cambios locales del usuario; revisar `git status` antes y después de tareas importantes.
- Los permisos y confirmaciones de Claude Code siguen vigentes; estas reglas no los reemplazan.
