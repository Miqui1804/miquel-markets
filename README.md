Miquel Markets

Web: https://miqui1804.github.io/miquel-markets/

App de iOS y Android: ver [app/README.md](app/README.md).

## Avisos por Telegram

GitHub Actions (workflow **Avisos por Telegram**) avisa por Telegram:

- **Cada actualización de la web:** comprueba en un navegador que la página carga sin errores y manda un resumen
  (título del cambio, semáforo, sentimiento y fecha de cada bloque de datos). Si la web queda rota, manda el error.
- **Cada mañana, de lunes a sábado (10:23 UTC):** avisa si algún bloque de datos no es del último día de mercado.
  Los datos semanales (mercado, sectores, rotación) se comprueban los lunes. Si todo está al día, no manda nada.
- **Si falla la compilación de la app** en `main`.
- **A mano o desde un agente:** Actions → *Avisos por Telegram* → *Run workflow*, con el texto a enviar
  (vacío envía un mensaje de prueba).

### Configurarlo (una sola vez)

1. En Telegram, abre **@BotFather**, escribe `/newbot` y sigue los pasos. Te dará un *token*.
2. Escribe cualquier mensaje a tu bot nuevo, para que pueda escribirte.
3. Abre **@userinfobot**: te dice tu *Id* numérico.
4. En GitHub → **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `TELEGRAM_BOT_TOKEN`: el token de BotFather.
   - `TELEGRAM_CHAT_ID`: tu Id.
5. Pruébalo: **Actions → Avisos por Telegram → Run workflow**.

Sin esos dos secrets el workflow sigue comprobando la web, pero no envía nada. El token no debe escribirse
nunca en el código ni en un chat.

El código está en `.github/avisos/`. Los festivos de la Bolsa de Nueva York están en `avisos.mjs` (2026 y 2027)
y hay que ampliarlos cada año.
