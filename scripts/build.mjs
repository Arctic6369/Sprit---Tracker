import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await rm('dist', { recursive: true, force: true });
await mkdir('dist/ocr', { recursive: true });
const assets = {
  'app.js': 'app.js',
  'icon.svg': 'icon.svg',
  'manifest.webmanifest': 'manifest.webmanifest',
  'ocr/tesseract.min.js': 'node_modules/tesseract.js/dist/tesseract.min.js',
  'ocr/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'ocr/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'ocr/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ocr/LICENSE-tesseract': 'node_modules/tesseract.js/LICENSE.md',
  'ocr/LICENSE-tesseract-core': 'node_modules/tesseract.js-core/LICENSE',
};
await Promise.all(Object.entries(assets).map(([dest, source]) => cp(source, 'dist/' + dest)));
const trainedData = await readFile('node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz');
// Android's asset packager strips the .gz suffix, so bundle the unpacked model explicitly.
await writeFile('dist/ocr/deu.traineddata', gunzipSync(trainedData));
const html = await readFile('index.html', 'utf8');
const cdn = '<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" defer></script>';
if (!html.includes(cdn)) throw new Error('OCR-Skript im HTML fehlt.');
await writeFile('dist/index.html', html.replace(cdn,
  '<script src="ocr/tesseract.min.js" defer></script><script src="android-bridge.js" defer></script>'));
await build({
  entryPoints: ['src/android-bridge.js'],
  outfile: 'dist/android-bridge.js',
  bundle: true,
  target: 'chrome89',
  logLevel: 'warning',
});
