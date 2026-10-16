## Application rules
- The app is React Native with Expo (SDK 58) and Expo Router; the web version runs through react-native-web from the same code. Do not add DOM-only UI (HTML elements, CSS files, Tailwind); use React Native primitives and `StyleSheet`.
- Install dependencies with `npx expo install <package>` so versions match the Expo SDK. Expo APIs change between SDKs: check https://docs.expo.dev/versions/v58.0.0/ instead of relying on memory.
- Store frontend demonstration state in the shared Facilitadores provider (`src/facilitadores/provider.tsx`), never present it as authenticated or durably saved data.
- Keep content sections in distinct file routes under `src/app/` and use the shared shell (`src/facilitadores/shell.tsx`) for navigation so desktop, web mobile and native stay consistent.
- Keep non-route code out of `src/app/`. Tests live in `__tests__/`.
- Before finishing a change run `npm run typecheck`, `npm run lint` and `npm test`.
