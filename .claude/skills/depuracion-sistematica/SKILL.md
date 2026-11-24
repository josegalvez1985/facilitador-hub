---
name: depuracion-sistematica
description: Diagnóstico estructurado de errores en esta app (síntoma → reproducción → hipótesis → evidencia → causa → corrección mínima), con la tabla de fallas ya conocidas del proyecto (APK vs web, CORS, token, ORDS, fechas, congelamientos). Usar cuando algo falla, no carga, se congela, muestra datos raros o se comporta distinto entre Android y la web.
---

# Depuración sistemática

No corregir a ciegas. Una hipótesis por vez, con evidencia.

## 1. Síntoma exacto
- Qué se ve (mensaje literal, captura), en qué pantalla, desde cuándo.
- Dónde: APK Android, PWA en iPhone, web escritorio. ¿Pasa en las otras?
- ¿Cambió algo? `git log --oneline -10`, `git diff`, ¿se corrió o no un script SQL?, ¿APK viejo?

## 2. Primero, las fallas conocidas
| Síntoma | Causa conocida | Dónde mirar |
|---|---|---|
| "Sin conexión" solo en el APK, la web anda | User-Agent con "okhttp" bloqueado por Akamai | `IDENTIDAD` y `pedir` en `src/facilitadores/auth/api.ts`; algún `fetch` directo |
| "blocked by CORS policy" en la web | URL que da 404 (ruta mal escrita o handler sin publicar), no CORS | ruta en el cliente vs `sql/README.md`; ¿se ejecutó el script? |
| Una ruta GET dejó de existir tras publicar el PUT (o al revés) | `ORDS.DEFINE_TEMPLATE` sobre plantilla existente borró los handlers | script SQL de esa ruta |
| `:authorization` llega NULL / siempre 401 | falta `ORDS.DEFINE_PARAMETER` del header en ese handler | script SQL |
| Datos en SQL Workshop pero vacío desde la app | nombre de día/mes sin `NLS_DATE_LANGUAGE=SPANISH` | consultas con `TO_CHAR(…, 'DAY')` o vistas APEX (usar copia `*_APP_ETHOS`) |
| DELETE responde 400 | se mandó cuerpo o `Content-Type` | llamada en el cliente |
| "Tu sesión se cerró" de repente | el usuario entró en el sistema anterior (un token por usuario) | comportamiento esperado |
| La app "no responde" en Android | trabajo pesado en el hilo principal (react-native-svg, decodificar PNG en jsPDF) | WebView como en `formularios/hoja-nativa.tsx`; imágenes JPEG chicas |
| Teclado tapa el campo en Android | edge-to-edge sin `KeyboardAvoidingView` | pantallas fuera de `(app)`, modales |
| Fecha o día corrido / formato raro en Android | Hermes y `toLocaleDateString` | usar `src/facilitadores/fechas.ts` |
| Cambio en `.env` sin efecto | `EXPO_PUBLIC_*` se inlinea al compilar | `npx expo start --clear` o build nuevo |
| Paquete nativo "no encontrado" en el APK | módulo agregado sin APK nuevo | construir APK |
| Compila con errores un paquete PL/SQL | constantes/tipos declarados después de procedimientos | cuerpo del paquete |

## 3. Reproducir
- Pasos mínimos y estables. Si depende del backend real, pedir al usuario la respuesta JSON o el mensaje de la red; no llamar a producción por cuenta propia.
- Para el backend: pedir al usuario que corra la consulta en SQL Workshop **y** compare con lo que devuelve el endpoint.

## 4. Hipótesis → evidencia
- Escribir 1 a 3 hipótesis ordenadas por probabilidad.
- Para cada una, qué evidencia la confirma o la descarta (línea de código, log, respuesta del servidor). Buscar con `Grep` todos los lugares afectados, no solo el primero.

## 5. Corregir
- La corrección mínima en la causa, no en el síntoma. Sin ocultar errores (nada de `catch` vacío).
- Revisar si el mismo error está en otras pantallas que comparten código.
- Separar lo nuevo de lo preexistente.

## 6. Cerrar
- `npm run typecheck` + `npx eslint <archivos>`; tests solo si el usuario los pidió.
- Informar: causa, evidencia, archivos cambiados, si requiere script SQL o APK nuevo, cómo verificarlo a mano.
- Si es una falla nueva y repetible, agregarla a la tabla de este skill.
