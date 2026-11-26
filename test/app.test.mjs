import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const entries = [
  { id: 'start', date: '2025-01-01', km: 1000, liters: 25, full: 'yes' },
  { id: 'teil;1', date: '2025-01-02', km: 1200, liters: 10.25, full: 'no' },
  { id: 'voll', date: '2025-01-03', km: 1500, liters: 29.75, full: 'yes', price: 1.75 },
];
const key = 'fuel_history_v2';

function element() {
  return {
    value: '', files: [], children: [],
    reset() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
  };
}

async function open(data = new Map()) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const exports = [];
  const errors = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: element, createElementNS: element },
    confirm: () => true,
    alert: message => errors.push(message),
    spritAndroid: {
      read: async key => data.get(key) ?? null,
      write: async (key, value) => data.set(key, value),
      exportFile: async (name, contents) => exports.push({ name, contents }),
      onRestoredPhoto: async () => {},
    },
  });
  vm.runInContext(script, context);
  await vm.runInContext('ready', context);
  return {
    get, exports, errors,
    consumption: () => vm.runInContext('calc(entries).avg', context),
    rows: () => get('rows').children.length,
    async importFile(name, contents) {
      get('import').files = [{ name, text: async () => contents }];
      await get('import').onchange();
    },
  };
}

test('Voll–Teil–Voll zählt Teilmengen und übersteht einen Neustart', async () => {
  const data = new Map();
  const first = await open(data);
  for (const entry of entries) {
    for (const field of ['date', 'km', 'liters', 'full']) first.get(field).value = String(entry[field]);
    await first.get('form').onsubmit({ preventDefault() {} });
  }
  assert.deepEqual(first.errors, []);
  const restarted = await open(data);
  assert.equal(restarted.rows(), 3);
  assert.equal(restarted.consumption(), 8);
});

test('Version-2-JSON und deutsches CSV lassen sich exportieren und wieder importieren', async () => {
  const data = new Map();
  const app = await open(data);
  await app.importFile('vorhanden.json', JSON.stringify({ version: 2, entries }));
  await app.get('backup').onclick();
  await app.get('csv').onclick();
  const [json, csv] = app.exports;
  assert.match(json.name, /\.json$/);
  assert.match(csv.name, /\.csv$/);
  assert.match(csv.contents, /^\ufeffid;date;km;liters;price;cost;full\r\n/);
  assert.match(csv.contents, /teil%3B1;2025-01-02;1200;10,25/);
  for (const { name, contents } of app.exports) {
    const freshData = new Map();
    const fresh = await open(freshData);
    await fresh.importFile(name, contents);
    assert.deepEqual(fresh.errors, []);
    assert.equal(fresh.consumption(), 8);
    assert.deepEqual(JSON.parse(freshData.get(key)), JSON.parse(data.get(key)));
  }
  assert.deepEqual(app.errors, []);
});

test('Unbekannte Füllung unterbricht die Messstrecke, fehlerhafter Import erhält die Historie', async () => {
  const data = new Map();
  const app = await open(data);
  await app.importFile('alt.json', JSON.stringify(entries.map(({ full, ...entry }, index) =>
    index === 1 ? entry : { ...entry, full })));
  assert.equal(app.consumption(), null);
  const saved = data.get(key);
  await app.importFile('defekt.csv', 'id;km\n1;1200');
  assert.match(app.errors[0], /Import fehlgeschlagen/);
  assert.equal(data.get(key), saved);
  assert.equal(app.rows(), 3);
});
