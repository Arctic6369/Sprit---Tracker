import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const app = 'de.arctic6369.sprittracker';
const apk = process.argv[2];
assert.ok(apk, 'Pfad zur Test-APK fehlt.');
const temp = mkdtempSync(join(tmpdir(), 'sprit-smoke-'));
const entries = [
  { id: 'start', date: '2025-01-01', km: 1000, liters: 25, full: 'yes' },
  { id: 'teil', date: '2025-01-02', km: 1200, liters: 10.25, full: 'no' },
  { id: 'voll', date: '2025-01-03', km: 1500, liters: 29.75, full: 'yes' },
];
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 25_000 }).trim();

async function waitFor(label, probe, timeout = 30_000) {
  const end = Date.now() + timeout;
  let error;
  while (Date.now() < end) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (e) {
      error = e;
    }
    await delay(400);
  }
  throw new Error('Zeitüberschreitung: ' + label, { cause: error });
}

function nodes() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/sprit-ui.xml');
  return adb('shell', 'cat', '/sdcard/sprit-ui.xml').match(/<node\b[^>]*>/g) ?? [];
}

function tap(node) {
  const bounds = node.match(/bounds="\[(\d+),(\d+)]\[(\d+),(\d+)]"/);
  assert.ok(bounds, node);
  const [x1, y1, x2, y2] = bounds.slice(1).map(Number);
  adb('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
}

async function tapWhen(label, pattern, timeout = 30_000) {
  tap(await waitFor(label, () => nodes().find(node => pattern.test(node)), timeout));
}

function back() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
}

let socket;
let port;
let commandId = 0;
const pending = new Map();
async function connect() {
  if (socket) socket.close();
  if (port) adb('forward', '--remove', 'tcp:' + port);
  const pid = await waitFor('Prozess der App', () => adb('shell', 'pidof', app));
  port = adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
  const target = await waitFor('WebView-Debugziel', async () => {
    const response = await fetch('http://127.0.0.1:' + port + '/json', { signal: AbortSignal.timeout(2000) });
    return (await response.json()).find(page => page.type === 'page' && page.url.startsWith('https://localhost'));
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  await waitFor('WebView geladen', () => evaluate("document.getElementById('storage')?.textContent === 'Lokaler Speicher verfügbar.'"));
}

async function evaluate(expression) {
  const id = ++commandId;
  let timer;
  const reply = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    timer = setTimeout(() => reject(new Error('CDP: ' + expression.slice(0, 100))), 45_000);
    socket.send(JSON.stringify({
      id, method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true, userGesture: true },
    }));
  });
  try {
    const response = await reply;
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  } finally {
    clearTimeout(timer);
    pending.delete(id);
  }
}

function start() {
  adb('shell', 'am', 'start', '-W', '-n', app + '/.MainActivity');
}

async function installImportFixture(name, content) {
  const file = join(temp, name);
  writeFileSync(file, content, 'utf8');
  adb('push', file, '/sdcard/Download/' + name);
  await evaluate("document.getElementById('restore').click(); null");
  const filePattern = new RegExp('text="' + name.replace('.', '\\.') + '"');
  const entry = await waitFor('Dateiauswahl geöffnet', () =>
    nodes().find(node => filePattern.test(node) || /content-desc="Show roots"/.test(node)));
  if (filePattern.test(entry)) {
    tap(entry);
  } else {
    tap(entry);
    await tapWhen('Downloads im Dateiauswahldialog', /text="Downloads"/);
    await tapWhen('Importdatei im Dateiauswahldialog', filePattern);
  }
  await tapWhen('Importbestätigung', /resource-id="android:id\/button1"/);
}

async function exportThroughChooser(button, suffix) {
  await evaluate("document.getElementById('" + button + "').click(); null");
  await waitFor('Android-Teiledialog für ' + suffix, () => {
    const activity = adb('shell', 'dumpsys', 'activity', 'activities');
    return /(?:mResumedActivity|topResumedActivity):.*(?:ChooserActivity|ResolverActivity)/.test(activity);
  });
  const paths = adb('shell', 'run-as', app, 'find', 'cache/exports', '-type', 'f').split('\n');
  const path = paths.find(path => path.endsWith(suffix));
  assert.ok(path, 'Android-Exportdatei ' + suffix + ' fehlt.');
  const contents = adb('shell', 'run-as', app, 'cat', path);
  back();
  await waitFor('Rückkehr aus dem Teiledialog', () =>
    new RegExp('(?:mResumedActivity|topResumedActivity):.*' + app.replaceAll('.', '\\.')).test(
      adb('shell', 'dumpsys', 'activity', 'activities')));
  return contents;
}

try {
  adb('install', '-r', apk);
  adb('shell', 'svc', 'wifi', 'disable');
  adb('shell', 'svc', 'data', 'disable');
  start();
  await connect();

  await installImportFixture('sprit-smoke.json', JSON.stringify({ version: 2, entries }));
  await waitFor('JSON in der Historie', () => evaluate("document.querySelectorAll('#rows tr').length === 3"));
  assert.equal(await evaluate("document.querySelectorAll('#rows tr').length"), 3);
  assert.equal(await evaluate('calc(entries).avg'), 8);
  console.log('Echte Android-Dateiauswahl: JSON importiert, Voll–Teil–Voll ergibt 8 L/100 km.');

  const json = await exportThroughChooser('backup', '.json');
  assert.equal(JSON.parse(json).entries.length, 3);
  const csv = await exportThroughChooser('csv', '.csv');
  assert.match(csv, /teil;2025-01-02;1200;10,25;;;no/);
  await installImportFixture('sprit-smoke.csv', '\ufeff' + csv.replace('teil;', 'teil-csv;'));
  await waitFor('CSV in der Historie', () => evaluate("entries.some(entry => entry.id === 'teil-csv')"));
  assert.equal(await evaluate('calc(entries).avg'), 8);
  console.log('Android-Teiledialog: JSON und CSV exportiert, CSV über Dateiauswahl wieder importiert.');

  adb('shell', 'am', 'force-stop', app);
  start();
  await connect();
  assert.equal(await evaluate("document.querySelectorAll('#rows tr').length"), 3);
  assert.equal(await evaluate('calc(entries).avg'), 8);
  console.log('Historie und Verbrauch nach Android-Prozessneustart erhalten.');

  await evaluate("document.getElementById('scanReceipt').click(); null");
  await tapWhen('Kamera im Quellendialog', /text="Foto aufnehmen"/);
  await tapWhen('Kameraverschluss', /resource-id="[^"]*\/shutter_button"|content-desc="(?:Shutter|Take photo|Take picture)"/, 45_000);
  await tapWhen('Kameraaufnahme bestätigen', /resource-id="[^"]*\/(?:done_button|review_done)"|content-desc="(?:Done|OK)"/);
  await waitFor('Kameraaufnahme an OCR übergeben', () => evaluate(
    "/^(?:Vorschlag:|Keine eindeutige Erkennung)/.test(document.getElementById('status').textContent)"
  ), 90_000);
  console.log('Foto mit Android-Kamera aufgenommen und an OCR übergeben.');

  await evaluate("(async () => {" +
    "const c = document.createElement('canvas'); c.width = 920; c.height = 280;" +
    "const ctx = c.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 920, 280);" +
    "ctx.fillStyle = 'black'; ctx.font = 'bold 82px sans-serif'; ctx.fillText('34,50 L', 70, 145);" +
    "scan(await new Promise(resolve => c.toBlob(resolve)), 'receipt');" +
    "})()");
  await waitFor('Deutsch-OCR ohne Netzwerk', () => evaluate("Number(document.getElementById('liters').value) === 34.5"), 90_000);
  console.log('Offline-OCR erkannte 34,50 L.');
} catch (error) {
  console.error('Letzter App-Status und Dialog:', await evaluate(
    "document.getElementById('status')?.textContent"
  ).catch(() => null));
  try { console.error(nodes().join('\n')); } catch {}
  throw error;
} finally {
  socket?.close();
  if (port) adb('forward', '--remove', 'tcp:' + port);
  rmSync(temp, { recursive: true, force: true });
}
