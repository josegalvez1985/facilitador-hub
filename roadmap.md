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
- [x] Fechas y semana actuales en toda la app.

## Pendiente
- [ ] Correr en APEX `sql/agenda_app_ethos.sql` y probar con TWALDE.
- [ ] Marcar: revisar por qué TWALDE no ve instituciones (esperando la respuesta de `mis-intervenciones/inicio`).
- [ ] Inicio: "Tus clases de hoy" con la agenda real.
- [ ] Reemplazar el resto de los datos de demostración de Inicio y Mis materiales.
- [ ] Reemplazar `sql/ords_modulo_ethos_export.sql` por la exportación completa.
- [ ] Portar las siguientes páginas de APEX (pasarme la exportación de cada una).
