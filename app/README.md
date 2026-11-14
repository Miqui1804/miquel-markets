# Miquel Markets · App de iOS y Android

La app muestra el mismo dashboard que la web (`https://miqui1804.github.io/miquel-markets/`).
Carga la web publicada, así que **cada actualización de datos que se sube a la web aparece
en la app al momento**, sin publicar una versión nueva en las tiendas.

Hay dos formas de tenerla en el móvil:

| | App instalable (PWA) | App nativa (esta carpeta) |
|---|---|---|
| Cómo se instala | Desde el navegador, «Añadir a pantalla de inicio» | App Store / Google Play (o APK en Android) |
| Coste | Gratis | Apple: 99 $/año · Google: 25 $ una vez |
| Necesita Mac | No | Solo para publicar en iOS |
| Datos | Siempre los últimos | Siempre los últimos |
| Sin conexión | Muestra la última versión vista | iPhone: pantalla «Sin conexión» con botón *Reintentar*. Android: la última versión vista (la pantalla «Sin conexión» solo sale si aún no se había abierto con internet) |

---

## 1. App instalable (PWA): disponible en cuanto la web esté publicada

- **iPhone / iPad (Safari):** botón **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
  En el menú ☰ de la web aparece «📲 Instalar app» con estas instrucciones.
- **Android (Chrome):** menú ☰ de la web → **📲 Instalar app** (o menú ⋮ de Chrome → *Instalar app*).

Se abre a pantalla completa, con su icono y respetando la *notch* y la barra inferior.
Al volver a abrirla, si se han publicado datos nuevos, se recarga sola.

Archivos de la web implicados: `manifest.webmanifest`, `sw.js`, `icons/` y un bloque al final de `index.html`.

---

## 2. App nativa (Capacitor)

### Probarla en Android sin tienda (APK)

Cada vez que cambia algo de `app/`, GitHub Actions compila la app (workflow **App móvil**):

1. GitHub → pestaña **Actions** → **App móvil** → la última ejecución.
2. En **Artifacts**, descarga `miquel-markets-android-apk` y descomprímelo.
3. Pasa `app-debug.apk` al móvil y ábrelo (Android pedirá permitir «instalar apps desconocidas»).

Es una versión de prueba firmada con una clave temporal: para instalar una versión más nueva
del APK, desinstala antes la anterior.

También se puede lanzar a mano: **Actions → App móvil → Run workflow**.

### Publicar en Google Play

1. Crea la cuenta de desarrollador en Google Play Console (25 $, pago único).
2. Crea **una sola vez** la clave de subida y guárdala en un lugar seguro (si se pierde, hay que pedir a Google que la cambie).
   Hazlo en una carpeta **fuera del repositorio**: es público y la clave no debe subirse nunca.
   `keytool` viene con Java (JDK) y con Android Studio.
   ```bash
   keytool -genkeypair -v -keystore miquel-markets-upload.keystore -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 miquel-markets-upload.keystore > keystore.txt   # en macOS: base64 -i miquel-markets-upload.keystore -o keystore.txt
   ```
   En Windows, el comando `keytool` se escribe en una sola línea (sin la `\`) y el segundo paso, en PowerShell, es:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\miquel-markets-upload.keystore")) | Set-Content keystore.txt
   ```
3. En GitHub → **Settings → Secrets and variables → Actions**, añade:
   - `ANDROID_KEYSTORE_BASE64`: el contenido de `keystore.txt`
   - `ANDROID_KEYSTORE_PASSWORD`: la contraseña del keystore
   - `ANDROID_KEY_ALIAS`: `upload`
   - `ANDROID_KEY_PASSWORD`: la contraseña de la clave (las versiones actuales de `keytool` solo piden una contraseña: es **la misma** que la del keystore)
4. Lanza **Actions → App móvil → Run workflow**. Además del APK saldrá `miquel-markets-android-aab`
   con el archivo `app-release.aab` firmado. El número de versión sube solo en cada ejecución.
5. En Play Console: crea la app, sube el `.aab` (primero en *Prueba interna*) y completa la ficha:
   - Seguridad de los datos: la app no recoge datos personales.
   - Indica que el contenido es informativo/educativo y no un servicio de inversión (el aviso legal ya está en la web).
   - Las cuentas personales nuevas deben hacer una prueba cerrada (12 testers durante 14 días) antes de publicar.

### Publicar en el App Store (necesita un Mac)

1. Apúntate al Apple Developer Program (99 $/año).
2. En el Mac, con Xcode instalado:
   ```bash
   cd app
   npm ci
   npx cap sync ios
   npx cap open ios
   ```
3. En Xcode: target **App** → *Signing & Capabilities* → elige tu **Team**.
4. Arriba, en el selector de dispositivo, elige **Any iOS Device (arm64)** (con un simulador elegido, *Archive* sale desactivado).
5. **Product → Archive → Distribute App → App Store Connect**, y desde App Store Connect envíala a revisión (o a TestFlight para probarla).

Ten en cuenta que Apple revisa con lupa las apps que son «una web dentro de una app» (norma 4.2).
Esta tiene icono, arranque y pantalla sin conexión propios y se adapta a la *notch*, pero lo que más ayuda
a que la aprueben es añadir algo propio de app, por ejemplo **notificaciones** cuando cambia el semáforo o
hay señales nuevas. Es el siguiente paso recomendable.

### Qué hace la app nativa

- Carga `https://miqui1804.github.io/miquel-markets/` (`capacitor.config.json` → `server.url`).
- Sin conexión muestra `www/offline.html` con un botón *Reintentar*. En Android, si ya se había abierto antes con internet,
  muestra en su lugar los datos de la última visita (igual que la web instalable).
- Se identifica en la web con `MiquelMarketsApp` en el *user agent*; la web añade la clase `mm-app` y
  **oculta el botón de donaciones**, porque Apple y Google no permiten pagos externos de este tipo dentro de apps.
- Los enlaces externos (PayPal, TradingView, correo…) se abren fuera de la app.
- Android: el botón atrás cierra menús y gráficos, vuelve a la sección anterior y, al final, minimiza la app.
- Barra de estado clara sobre el fondo azul marino de la marca y sin destellos blancos al arrancar.

### Desarrollo

```bash
cd app
npm ci                 # dependencias
npx cap sync           # copia www/ y la configuración a android/ e ios/
npx cap open android   # abre Android Studio
npx cap open ios       # abre Xcode (solo en Mac)
```

- Identificador de la app: `io.github.miqui1804.miquelmarkets` (no se puede cambiar una vez publicada).
- **Iconos y pantalla de arranque:** salen de `assets/` (logo del toro, zona verde). Para cambiarlos,
  sustituye `assets/icon-only.png`, `icon-foreground.png`, `icon-background.png` y `splash.png` (`splash-dark.png`)
  y ejecuta `npm run icons`.
- **Versión visible:** `versionName` en `android/app/build.gradle` y *Version* en Xcode.
