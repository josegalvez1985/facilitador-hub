---
name: preparar-publicacion
description: Lista de verificación antes de publicar una versión (web/PWA en GitHub Pages y APK/AAB por GitHub Actions) - typecheck, lint, manual regenerado, scripts SQL pendientes, módulos nativos, dependencias, firma y notas de versión. Usar cuando el usuario quiere publicar, hacer push a main o sacar un APK nuevo. No publica nada por sí solo.
---

# Preparar una publicación

Un push a `main` dispara `.github/workflows/web.yml` (PWA en https://facilitadoresfc.online) y `.github/workflows/apk.yml` (APK y, con secretos `UPLOAD_*`, AAB para Google Play). Por eso **push = publicación**: nunca hacerlo sin aprobación explícita del usuario.

## 1. Estado
- [ ] `git status` limpio o con solo lo que se va a publicar; nada de `.env`, `*.jks`, `*.key`, `.claude/settings.local.json`.
- [ ] `git log origin/main..HEAD --oneline`: qué commits salen.

## 2. Calidad
- [ ] `npm run typecheck`.
- [ ] `npx eslint` sobre los archivos cambiados desde el último push (`git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx'`).
- [ ] `npm test` **solo si el usuario lo pide**.
- [ ] Si cambió `docs/manual-usuario.md`: `npm run manual` y `src/facilitadores/manual.ts` incluido en el commit.

## 3. Backend
- [ ] ¿Algún cambio depende de un script de `sql/` nuevo o modificado? Listar cuáles y preguntarle al usuario si ya los ejecutó en APEX. Si no, la versión publicada fallará en esas pantallas: publicar después.

## 4. Nativo y dependencias
- [ ] ¿Se agregó o actualizó un módulo nativo o cambió `app.json` (permisos, plugins)? → los usuarios necesitan instalar el APK nuevo; avisarlo.
- [ ] `npx expo install --check`: versiones alineadas con el SDK 58 (no actualizar nada sin aprobación).
- [ ] `npm audit --omit=dev`: informar vulnerabilidades altas/críticas; no correr `npm audit fix` sin aprobación.

## 5. Firma y versión (no tocar)
- [ ] La clave debug y `FIRMA_ESPERADA` en `apk.yml` no cambiaron.
- [ ] El keystore de subida y sus contraseñas solo están en secretos de GitHub.
- [ ] `versionCode` lo pone el workflow (número de ejecución): no editarlo a mano.

## 6. Entrega al usuario
- Resumen para facilitadores (qué cambia para ellos, en lenguaje simple).
- Scripts SQL a ejecutar antes, si hay.
- Si hace falta reinstalar o actualizar el APK.
- Pedir confirmación: "¿Hago push a main?" Después del push, revisar los workflows con `gh run list --limit 2` y `gh run view <id>` e informar el resultado real.

## Rollback
- Web: `git revert <commit>` + push (vuelve a publicar la versión anterior en Pages).
- APK: publicar un APK nuevo con el revert; no se puede bajar el `versionCode`.
