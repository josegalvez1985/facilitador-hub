---
name: registrar-decision
description: Registra una decisión técnica o de producto del usuario (o una lección aprendida de un error) en AGENTS.md, con fecha y motivo, en el estilo del proyecto, para que ningún agente la "corrija" después. Usar cuando el usuario decide algo que cambia o hace excepción a una regla, elige entre alternativas, o cuando un error revela una regla nueva.
---

# Registrar una decisión

En este proyecto las decisiones viven en `AGENTS.md`, junto a la regla que afectan, con la fecha y "by the user's decision". No se usan archivos ADR separados.

## Cuándo
- El usuario elige entre alternativas ("que la postulación sea para cualquier usuario").
- Se acepta una excepción a una regla (aislamiento, almacenamiento, sesión).
- Un error mostró algo que hay que evitar siempre (ej. `DEFINE_TEMPLATE` borró handlers de `mis-facturas`).
- No registrar detalles que ya dice el código ni preferencias de una sola tarea.

## Cómo
1. Encontrar la sección de `AGENTS.md` donde aplica (Application rules, Backend, Session rules, la página portada). No crear secciones nuevas si alguna encaja.
2. Escribir en **inglés**, en el mismo estilo: la regla primero, después el motivo o el antecedente.
   - Decisión: `… open to ANY logged user, by the user's decision (DD/MM/YYYY): …`
   - Lección: `… on an existing template it replaces it and deletes its handlers … This happened to \`mis-facturas\`.`
3. Usar la fecha actual del sistema (formato `DD/MM/YYYY`).
4. Si la decisión contradice algo escrito, **reemplazar** la regla vieja; no dejar dos reglas en conflicto.
5. Si también la deben conocer los agentes especializados, revisar si el cuerpo de algún archivo en `.claude/agents/` o `.claude/skills/` dice lo contrario y actualizarlo.
6. Mostrarle al usuario el texto agregado o cambiado.

## No
- No registrar decisiones que el usuario no tomó ("por buena práctica").
- No escribir secretos, datos personales ni URLs privadas.
