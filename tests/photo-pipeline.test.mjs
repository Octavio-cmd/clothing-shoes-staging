import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('photo pipeline — never manufactures a blank white fallback', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clTakePhoto', start);
  const fn = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /preserving original photo/);
  assert.match(fn, /finish\(fallbackUrl \|\| dataUrl\)/);
  assert.doesNotMatch(fn, /creating fallback white square/);
});

test('photo pipeline — gives mobile canvas enough time and preserves fallback', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clTakePhoto', start);
  const fn = app.slice(start, end);
  assert.match(fn, /}, 15000\)/);
  assert.match(fn, /fallbackUrl=dataUrl/);
});

test('photo pipeline — requests transparent PNG and accepts JPEG or PNG responses', () => {
  const start = app.indexOf('function clTakePhoto');
  const end = app.indexOf('function clCompressImage', start);
  const fn = app.slice(start, end);
  assert.match(fn, /outputBlob = await workerRes\.blob\(\)/);
  assert.match(fn, /result\.mime === 'image\/jpeg'/);
  assert.match(fn, /'image\/png'/);
  assert.match(fn, /applyWhiteSquare\(processedUrl, 1600, dataUrl\)/);
});

test('photo pipeline — rembg cannot wait forever', () => {
  const start = app.indexOf('function clTakePhoto');
  const end = app.indexOf('function clCompressImage', start);
  const fn = app.slice(start, end);
  assert.match(fn, /controller\.abort\(\), 240000/);
  assert.match(fn, /if \(!workerRes\.ok\) throw new Error/);
});

test('photo UI — previews preserve the entire garment or shoe', () => {
  assert.match(html, /\.cl-photo-preview\{[^}]*object-fit:contain/);
  assert.match(html, /\.cl-review-thumb\{[^}]*object-fit:contain/);
  assert.doesNotMatch(html, /\.cl-photo-preview\{[^}]*object-fit:cover/);
  assert.doesNotMatch(html, /\.cl-review-thumb\{[^}]*object-fit:cover/);
});

test('photo deployment — app.js cache key is bumped for employee devices', () => {
  assert.match(html, /app\.js\?v=20261123-ben2-beta-4/);
});

test('photo pipeline — requests neutral brightness and a repairable PNG mask', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clCompressImage', start);
  const fn = app.slice(start, end);
  assert.match(app, /const REMBG_PROCESSOR='https:\/\/savvy-background-engine-v2-beta-production\.up\.railway\.app\/remove-bg'/);
  assert.match(fn, /new FormData\(\)/);
  assert.match(fn, /form\.append\('file', new Blob/);
  assert.match(fn, /workerRes\.blob\(\)/);
  assert.match(fn, /if \(\/\^data:image\\\/jpeg\/i\.test\(dataUrl\)\)/);
  assert.match(fn, /Direct rembg unavailable — using proxy fallback/);
});

test('photo pipeline — protects one-pixel edges on predominantly light products', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clTakePhoto', start);
  const fn = app.slice(start, end);
  assert.match(fn, /const originalAlpha = new Uint8ClampedArray/);
  assert.match(fn, /if \(neighborMax >= 235\) px\[p\*4\+3\] = Math\.max\(px\[p\*4\+3\], 210\)/);
  assert.doesNotMatch(fn, /oy=-2|ox=-2/);
});

test('photo pipeline — BEN2 uses the proven cleanup path instead of raw alpha', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clTakePhoto', start);
  const fn = app.slice(start, end);
  assert.doesNotMatch(fn, /rawPx\[\(y\*img\.width\+x\)\*4\+3\]/);
  assert.match(fn, /if \(a <= 89\) px\[i\] = 0/);
  assert.match(fn, /else if \(a >= 166\) px\[i\] = 255/);
});

test('photo pipeline — restores detail only on predominantly light products', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clTakePhoto', start);
  const fn = app.slice(start, end);
  assert.match(fn, /lightNeutralCount\/opaqueCount >= 0\.42/);
  assert.match(fn, /if \(isLightProduct\)/);
  assert.match(fn, /250 - \(255 - px\[i\+c\]\) \* 1\.18/);
  assert.match(fn, /px\[colorIndex\]\*opacity \+ 252\*\(1-opacity\)/);
  assert.match(fn, /if \(a <= 20\) px\[i\] = 0/);
  assert.match(fn, /else if \(a >= 235\) px\[i\] = 255/);
  assert.match(fn, /ctx\.fillStyle = '#F3F3F3'/);
});

test('photo pipeline — cleans semi-transparent background halo before white composite', () => {
  const start = app.indexOf('function applyWhiteSquare');
  const end = app.indexOf('function clTakePhoto', start);
  const fn = app.slice(start, end);
  assert.match(fn, /if \(a <= 89\) px\[i\] = 0/);
  assert.match(fn, /else if \(a >= 166\) px\[i\] = 255/);
  assert.match(fn, /tmpCtx\.putImageData\(imageData, 0, 0\)/);
  assert.match(fn, /ctx\.drawImage\(tmp,/);
});

test('photo compression — high-quality smoothing is enabled', () => {
  const start = app.indexOf('function clCompressImage');
  const end = app.indexOf('function clStep4Next', start);
  const fn = app.slice(start, end);
  assert.match(fn, /imageSmoothingEnabled = true/);
  assert.match(fn, /imageSmoothingQuality = 'high'/);
  assert.match(fn, /Image compression timeout/);
  assert.match(fn, /reader\.onerror = \(\) => finish\(null\)/);
  assert.match(fn, /reader\.onabort = \(\) => finish\(null\)/);
  assert.match(fn, /img\.onerror = \(\) => finish\(null\)/);
});
