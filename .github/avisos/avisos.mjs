#!/usr/bin/env node
/* Avisos de Miquel Markets por Telegram.
 *
 *   node avisos.mjs comprobar   Abre la web en un navegador, comprueba que funciona y avisa del resultado.
 *   node avisos.mjs caducidad   Avisa si algún bloque de datos no es del último día de mercado.
 *   node avisos.mjs mensaje     Envía el texto de la variable MENSAJE (vacío = mensaje de prueba).
 *
 * Variables de entorno:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   Secrets del repositorio. Si faltan, no se envía nada.
 *   TITULO                                 Título del cambio (el mensaje del commit).
 *   ENLACE                                 Enlace al detalle de la ejecución, para los errores.
 *   SIN_ENVIAR=1                           Solo escribe el mensaje en el registro (pull requests y pruebas).
 *   HOY=AAAA-MM-DD, CHART_JS_LOCAL=ruta    Solo para pruebas.
 */
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = 'https://miqui1804.github.io/miquel-markets/';
const env = process.env;

/* Bloques de datos de index.html: nombre visible, cada cuánto se actualizan y si son imprescindibles */
const BLOQUES = {
  amplitud: { nombre: 'Amplitud NYSE', ritmo: 'diario', obligatorio: true },
  medias: { nombre: '% sobre medias', ritmo: 'diario', obligatorio: true },
  sentimiento: { nombre: 'Sentimiento', ritmo: 'diario', obligatorio: true },
  mercado: { nombre: 'Mercado y semáforo', ritmo: 'semanal', obligatorio: true },
  sectores: { nombre: 'Sectores', ritmo: 'semanal', obligatorio: true },
  rotacion: { nombre: 'Rotación estacional', ritmo: 'semanal', obligatorio: false },
};

/* Días sin sesión en la Bolsa de Nueva York (además de sábados y domingos). Ampliar cada año. */
const FESTIVOS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
const ANIOS_CON_FESTIVOS = new Set([...FESTIVOS].map((f) => f.slice(0, 4)));

const iso = (d) => d.toISOString().slice(0, 10);
const esFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const corta = (s) => (esFecha(s) ? s.split('-').reverse().join('/') : String(s));
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hoy = () => (esFecha(env.HOY) ? new Date(env.HOY + 'T12:00:00Z') : new Date());

function haySesion(d) {
  const dia = d.getUTCDay();
  return dia !== 0 && dia !== 6 && !FESTIVOS.has(iso(d));
}
function ultimaSesionAntesDe(fecha) {
  const d = new Date(fecha);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (!haySesion(d));
  return d;
}

/* ---------- la web, servida en local y abierta en un navegador de verdad ---------- */
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
};
function servir() {
  const srv = http.createServer(async (req, res) => {
    try {
      let ruta = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (ruta.endsWith('/')) ruta += 'index.html';
      const fichero = path.join(RAIZ, ruta);
      if (!fichero.startsWith(RAIZ + path.sep)) throw new Error('fuera del sitio');
      const datos = await readFile(fichero);
      res.writeHead(200, { 'content-type': TIPOS[path.extname(fichero)] || 'application/octet-stream' });
      res.end(datos);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

async function leerWeb() {
  const { chromium } = await import('playwright');
  const srv = await servir();
  const navegador = await chromium.launch();
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' });
    if (env.CHART_JS_LOCAL) {
      await ctx.route(/chart\.umd/, (r) => r.fulfill({ path: env.CHART_JS_LOCAL, contentType: 'text/javascript' }));
    }
    const pag = await ctx.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'load', timeout: 60000 });
    await pag
      .waitForFunction(() => window.Chart && Object.keys(window.Chart.instances || {}).length > 0, null, { timeout: 15000 })
      .catch(() => {});
    await pag.waitForTimeout(1500);
    const datos = await pag.evaluate(() => {
      const leer = (f) => { try { return f(); } catch { return null; } };
      const texto = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      const panico = document.getElementById('heroPanico');
      return {
        /* eslint-disable no-undef */
        fechas: {
          amplitud: leer(() => BREADTH.d[BREADTH.d.length - 1]),
          medias: leer(() => MA_BREADTH.asof),
          sentimiento: leer(() => SENTIMIENTO.asof),
          mercado: leer(() => MARKET.asof),
          sectores: leer(() => SECTORES.asof),
          rotacion: leer(() => ROTACION.asof),
        },
        semaforo: texto('#heroSem'),
        sentimiento: texto('#heroSalud'),
        panico: panico && !panico.hidden ? panico.textContent.replace(/\s+/g, ' ').trim() : null,
        fechaCabecera: texto('.nav-date'),
        graficos: window.Chart ? Object.keys(window.Chart.instances || {}).length : 0,
      };
    });
    return { errores, ...datos };
  } finally {
    await navegador.close();
    srv.close();
  }
}

/* Un fallo pasajero (por ejemplo, la CDN de Chart.js) no debe dar una falsa alarma: se reintenta una vez. */
async function leerWebConReintento() {
  let web = await leerWeb();
  if (revisar(web).errores.length) {
    console.log('Primer intento con errores; se repite la comprobación.');
    await new Promise((ok) => setTimeout(ok, 5000));
    web = await leerWeb();
  }
  return web;
}

function revisar(web) {
  const errores = [];
  for (const e of web.errores.slice(0, 3)) errores.push('Error de JavaScript: ' + e.slice(0, 180));
  if (web.errores.length > 3) errores.push(`…y ${web.errores.length - 3} errores de JavaScript más`);
  if (!web.graficos) errores.push('No se ha dibujado ningún gráfico');
  // Con un error de JavaScript el resto de comprobaciones fallan en cadena: basta con la causa
  if (web.errores.length) return { errores };
  if (!web.semaforo) errores.push('No aparece el semáforo en la cabecera');
  const manana = new Date(hoy());
  manana.setUTCDate(manana.getUTCDate() + 1);
  for (const [clave, b] of Object.entries(BLOQUES)) {
    const f = web.fechas[clave];
    if (!esFecha(f)) {
      if (b.obligatorio) errores.push(`${b.nombre}: no se puede leer la fecha de los datos`);
    } else if (f > iso(manana)) {
      errores.push(`${b.nombre}: la fecha de los datos (${corta(f)}) es futura`);
    }
  }
  return { errores };
}

const resumenEstado = (web) => [web.semaforo, web.sentimiento, web.panico].filter(Boolean).join(' | ');
function resumenFechas(web) {
  return Object.entries(BLOQUES)
    .filter(([clave]) => esFecha(web.fechas[clave]))
    .map(([clave, b]) => `${b.nombre} ${corta(web.fechas[clave]).slice(0, 5)}`)
    .join(' · ');
}

/* ---------- Telegram ---------- */
async function enviar(texto) {
  console.log('----- mensaje -----\n' + texto + '\n-------------------');
  if (env.SIN_ENVIAR === '1') {
    console.log('SIN_ENVIAR=1: no se envía.');
    return true;
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log('Avisos sin configurar: faltan los secrets TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID. No se envía nada.');
    return true;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: texto.slice(0, 4000), link_preview_options: { is_disabled: true } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      console.error(`Telegram ha rechazado el mensaje (${r.status}): ${j.description || 'sin detalle'}`);
      return false;
    }
    console.log('Mensaje enviado por Telegram.');
    return true;
  } catch {
    console.error('No se ha podido conectar con Telegram.');
    return false;
  }
}

/* ---------- modos ---------- */
async function comprobar() {
  const web = await leerWebConReintento();
  const { errores } = revisar(web);
  const titulo = (env.TITULO || '').split('\n')[0].trim();
  console.log(JSON.stringify({ ...web, errores: web.errores }, null, 1));
  let texto;
  if (errores.length) {
    texto = ['❌ Miquel Markets: la web tiene errores tras la actualización', titulo, ...errores.map((e) => '• ' + e), env.ENLACE ? 'Detalle: ' + env.ENLACE : '']
      .filter(Boolean)
      .join('\n');
  } else {
    texto = ['✅ Miquel Markets actualizado', titulo, resumenEstado(web), resumenFechas(web), WEB].filter(Boolean).join('\n');
  }
  const enviado = await enviar(texto);
  return errores.length || !enviado ? 1 : 0;
}

async function caducidad() {
  const web = await leerWebConReintento();
  const { errores } = revisar(web);
  const dia = hoy();
  const esperada = ultimaSesionAntesDe(dia);
  const esLunes = dia.getUTCDay() === 1; // los datos semanales (los del sábado) se comprueban los lunes
  const atrasados = Object.entries(BLOQUES)
    .filter(([clave, b]) => (b.ritmo === 'diario' || esLunes) && esFecha(web.fechas[clave]) && web.fechas[clave] < iso(esperada))
    .map(([clave, b]) => `• ${b.nombre}: datos al ${corta(web.fechas[clave])}`);
  console.log(JSON.stringify({ hoy: iso(dia), sesionEsperada: iso(esperada), fechas: web.fechas, errores }, null, 1));
  if (!atrasados.length && !errores.length) {
    console.log('Datos al día: no se envía ningún aviso.');
    return 0;
  }
  const lineas = [];
  if (atrasados.length) {
    lineas.push('⚠️ Miquel Markets: hay datos sin actualizar');
    lineas.push(`Último día de mercado: ${DIAS[esperada.getUTCDay()]} ${corta(iso(esperada))}`);
    lineas.push(...atrasados);
    if (!ANIOS_CON_FESTIVOS.has(iso(esperada).slice(0, 4))) lineas.push('(Si ese día fue festivo en EE. UU., ignora este aviso.)');
  }
  if (errores.length) {
    lineas.push('❌ Miquel Markets: la web tiene errores', ...errores.map((e) => '• ' + e));
    if (env.ENLACE) lineas.push('Detalle: ' + env.ENLACE);
  }
  lineas.push(WEB);
  const enviado = await enviar(lineas.join('\n'));
  return errores.length || !enviado ? 1 : 0;
}

async function mensaje() {
  const texto = (env.MENSAJE || '').trim() || '🔔 Prueba: los avisos de Miquel Markets por Telegram funcionan.';
  return (await enviar(texto)) ? 0 : 1;
}

const MODOS = { comprobar, caducidad, mensaje };
const modo = MODOS[process.argv[2]];
if (!modo) {
  console.error('Uso: node avisos.mjs comprobar | caducidad | mensaje');
  process.exit(2);
}
modo().then(
  (codigo) => process.exit(codigo),
  async (e) => {
    console.error(e);
    await enviar(['❌ Miquel Markets: no se ha podido comprobar la web', String((e && e.message) || e).slice(0, 300), env.ENLACE ? 'Detalle: ' + env.ENLACE : ''].filter(Boolean).join('\n'));
    process.exit(1);
  },
);
