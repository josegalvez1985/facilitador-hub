# Facilitadores

App para facilitadores educativos: marcar entrada a las clases (con ubicación), organizar horarios, gestionar los manuales e índices desarrollados por grado e institución, y administrar el perfil.

Está hecha con **React Native + Expo**. Una sola base de código funciona en **iOS, Android y web**; la web usa `react-native-web`.

> Esta versión es una demostración del frontend. Los datos son de ejemplo, el login todavía no está conectado a una base de datos y las marcaciones no guardan una ubicación real.

## Requisitos

- Node.js 20 o superior y npm
- Para probar en el celular: la app **Expo Go** (iOS/Android)

## Desarrollo

```sh
npm install
npm run dev      # (o npm start) servidor de Expo: escaneá el QR con Expo Go
npm run web      # versión web en el navegador
npm run android  # emulador Android
npm run ios      # simulador iOS (solo macOS)
```

Otros comandos:

```sh
npm run typecheck   # TypeScript
npm run lint        # ESLint (eslint-config-expo)
npm test            # Jest + Testing Library
npm run build:web   # build estática de la web en dist/
```

## Estructura

```
src/
  app/                    Rutas (Expo Router)
    _layout.tsx           Raíz: fuentes, safe area y provider
    login.tsx             /login
    (app)/_layout.tsx     Shell compartido (barra lateral / navegación inferior)
    (app)/index.tsx       /           Inicio
    (app)/horarios.tsx    /horarios
    (app)/materiales.tsx  /materiales
    (app)/perfil.tsx      /perfil
  facilitadores/
    theme.ts              Colores, tipografía y puntos de quiebre
    data.ts               Datos de demostración
    provider.tsx          Estado compartido de la demostración
    ui.tsx                Componentes base (Text, Button, Badge, Field, Modal…)
    shell.tsx             Navegación responsive
    screens/              Pantallas
assets/                   Íconos de la app e imágenes
__tests__/                Tests
```

## Diseño responsive

- **Menos de 800 px de ancho** (celulares): barra superior, navegación inferior con el botón central **Marcar**.
- **800 px o más** (tablets, escritorio, web): barra lateral fija y la columna de calendario y accesos rápidos.

## Instalación en celulares

### Android: APK

El APK se compila en la nube con EAS Build. Requiere una cuenta gratuita de Expo.

```sh
npx eas-cli@latest login
npm run build:apk
```

Al terminar, EAS entrega un link y un código QR para descargar el `.apk` e instalarlo en el celular. Hay que permitir "instalar apps de origen desconocido". El perfil está en `eas.json` → `apk`.

### iOS: PWA

En iPhone la app se instala como PWA (aplicación web) desde Safari:

```sh
npm run build:pwa   # genera la carpeta dist/
```

1. Publicá la carpeta `dist/` en un hosting con **HTTPS**, por ejemplo `npx eas-cli@latest deploy` (EAS Hosting), Netlify o Vercel. Configurá el hosting para que todas las rutas devuelvan `index.html`.
2. En el iPhone, abrí la URL en **Safari** → botón Compartir → **Agregar a pantalla de inicio**.

El ícono, el nombre y la pantalla completa salen de `public/manifest.json`, `public/apple-touch-icon.png` y `public/index.html`.

### Logo e íconos

El logo original está en `public/logo.png`. A partir de él se generaron:

- `assets/icon.png`: ícono de la app
- `assets/android-icon-*.png`: ícono adaptativo de Android
- `assets/splash-icon.png`: pantalla de carga
- `public/logo192.png`, `public/logo512.png`, `public/logo-maskable.png`, `public/apple-touch-icon.png` y `favicon.png`: íconos de la PWA
- `assets/images/logo.png`: logo dentro de la app

Las carpetas `ios/` y `android/` se generan automáticamente y no se versionan.
