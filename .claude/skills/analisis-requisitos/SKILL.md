---
name: analisis-requisitos
description: Convierte un pedido del usuario en requisitos claros, criterios de aceptación verificables, alcance, riesgos y preguntas pendientes, y lo divide en tareas con dependencias y agentes. Usar antes de implementar pedidos amplios, ambiguos o que tocan varias capas (pantalla + endpoint + datos).
---

# Análisis de requisitos y plan

Objetivo: que antes de programar estén claros el qué, el para quién y cómo se sabe que está terminado. No inventar requisitos: lo que no se sabe se pregunta.

## 1. Entender
- ¿Quién lo usa? (facilitador en el celular, en la PWA, en escritorio; administrador del sitio).
- ¿Qué tarea real resuelve? ¿Reemplaza una página APEX? (entonces: skill `portar-pagina-apex`).
- ¿Qué existe hoy? Buscar en `src/`, `sql/`, `README.md` y `AGENTS.md` funciones parecidas o decisiones previas del usuario (las que tienen fecha en `AGENTS.md` no se discuten).

## 2. Escribir
```
Objetivo: <una frase>
Usuarios: <quién>
Alcance: <qué entra>
Fuera de alcance: <qué no entra>
Requisitos:
  R1. …
Criterios de aceptación (verificables):
  CA1. Dado <situación>, cuando <acción>, entonces <resultado visible>.
  … incluir: sin facilitador, sin conexión, vacío, error del servidor, período cerrado, Android y PWA.
Datos: endpoints existentes que sirven / endpoint nuevo / tablas que faltan conocer.
Reglas de AGENTS.md que aplican: …
Riesgos: …
Preguntas para el usuario: …
```

## 3. Dividir en tareas
| # | Tarea | Agente | Depende de | Archivos |
|---|---|---|---|---|
- Orden típico: análisis → backend (script SQL) → cliente → manual → revisión.
- Tareas en paralelo solo si no tocan los mismos archivos.
- Marcar lo que necesita que el usuario ejecute un script en APEX o instale un APK nuevo.

## 4. Decidir
- Si hay preguntas que bloquean, hacerlas antes de implementar (máximo las necesarias, cada una con una opción recomendada).
- Cambios amplios, sensibles o destructivos: presentar el plan y esperar aprobación.
