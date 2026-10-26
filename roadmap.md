# Facilitadores

## Hecho
- [x] Diseño claro y profesional, navegación móvil y de escritorio.
- [x] Migración a React Native + Expo (APK para Android, PWA para iOS, web con react-native-web).
- [x] Logo del proyecto e íconos de instalación.
- [x] Modo claro/oscuro y 6 temas de color en Perfil.
- [x] Login conectado al backend ORDS (módulo `ethos`), probado con un usuario real.
- [x] ID_FACILITADOR global de la sesión, con aislamiento de datos entre facilitadores.
- [x] Barra inferior del celular: Inicio · Marcar · Menú · Perfil · Salir.
- [x] Evaluaciones (página 11 de APEX): pantalla, menú y endpoints `mi-facilitador` / `mis-evaluaciones`.
- [x] Marcar / Registrar intervención (página 2 de APEX), con GPS y endpoints `mis-intervenciones/*`.
- [x] KPI "Marcaciones del mes" del facilitador logueado.
- [x] Mis horarios (página 3 de APEX) con `mi-agenda`.
- [x] Inicio: los 4 KPIs, Tus clases de hoy y Actividad reciente con datos reales.
- [x] Mi agenda: próximo índice por clase y vista Línea de tiempo.
- [x] Mis materiales: manuales e índices desarrollados y pendientes.
- [x] Intervenciones realizadas (páginas 4, 5 y 6 de APEX) en una sola pantalla, con contadores.
- [x] Historial de intervenciones (páginas 7 y 8 de APEX): búsqueda, facetas Mes/Fecha y edición.
- [x] Mi agenda: se quitó "Añadir clase"; la Línea de tiempo muestra la institución.
- [x] Colores de los manuales iguales a los del sistema APEX.
- [x] Fechas y semana actuales en toda la app.
- [x] Perfil: foto de perfil guardada en el dispositivo (por usuario), visible en Inicio, el menú lateral y el panel Menú.
- [x] Inicio: foto con aureola animada en los colores del tema, junto al saludo.
- [x] Barra superior sin avatar: solo título y campana.
- [x] Manual de uso en Perfil → Ayuda (`docs/manual-usuario.md`, `npm run manual`).
- [x] Campana de notificaciones: próxima clase e institución según la hora actual, con punto de "nueva" que se apaga al verla.
- [x] Formularios 1, 2 y 3 (del sitio editorial-ethos-app) en PDF e imagen, solo con las clases del facilitador, con endpoints `mis-formularios/*`.

## Pendiente
- [ ] Correr en APEX `sql/formularios_app_ethos.sql` (publica `mis-formularios/*`, 4 de 4) y probar los tres formularios con un facilitador real; comparar con el sitio editorial-ethos-app.
- [ ] Generar un APK nuevo para Formularios (`expo-sharing` es un módulo nativo) y probar PDF e Imagen en Android.
- [ ] Correr en APEX: `sql/historial_app_ethos.sql`, `sql/intervenciones_realizadas_app_ethos.sql`, `sql/agenda_app_ethos.sql`, `sql/materiales_app_ethos.sql` y de nuevo `sql/intervenciones_app_ethos.sql` (agrega el resumen ampliado y recientes); probar con TWALDE.
- [ ] Marcar sin instituciones: causa encontrada. `V_INSTITUCIONES` compara el día con `TO_CHAR(..,'FMDAY')`, que en ORDS sale en inglés ("FRIDAY") y nunca coincide. Sin tocar APEX: volver a correr `sql/intervenciones_app_ethos.sql` (crea la copia `V_INSTITUCIONES_APP_ETHOS` y el paquete la usa) y probar con SALVADORAGB.
- [ ] Reemplazar `sql/ords_modulo_ethos_export.sql` por la exportación completa.
- [ ] Gráfico de intervenciones por semana: correr de nuevo `sql/intervenciones_app_ethos.sql` (publica `mis-intervenciones/por-dia`; deben quedar 8 de 8 handlers).
- [ ] Cumpleaños en Inicio: correr de nuevo `sql/facilitador_app_ethos.sql` (publica `cumpleanios-hoy`) y confirmar con su salida los valores de `ACTIVO`.
- [ ] Generar un APK nuevo para que la foto de perfil funcione en Android (`expo-image-picker` y `expo-image-manipulator` son módulos nativos). El workflow `APK` lo hace en el próximo push.
- [ ] Probar la primera corrida del workflow `APK` en GitHub Actions y que el celular instale `facilitadores.apk`.
- [ ] Portar las siguientes páginas de APEX (pasarme la exportación de cada una).
