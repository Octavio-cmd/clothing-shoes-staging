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

test('photo pipeline — requests compact JPEG but accepts JPEG or PNG responses', () => {
  const start = app.indexOf('function clTakePhoto');
  const end = app.indexOf('function clCompressImage', start);
  const fn = app.slice(start, end);
  assert.match(fn, /format: 'jpeg', quality: 92/);
  assert.match(fn, /result\.mime === 'image\/jpeg'/);
  assert.match(fn, /'image\/png'/);
  assert.match(fn, /applyWhiteSquare\(processedUrl, 1600, dataUrl\)/);
});

test('photo pipeline — rembg cannot wait forever', () => {
  const start = app.indexOf('function clTakePhoto');
  const end = app.indexOf('function clCompressImage', start);
  const fn = app.slice(start, end);
  assert.match(fn, /controller\.abort\(\), 30000/);
  assert.match(fn, /if \(!workerRes\.ok\) throw new Error/);
});

test('photo UI — previews preserve the entire garment or shoe', () => {
  assert.match(html, /\.cl-photo-preview\{[^}]*object-fit:contain/);
  assert.match(html, /\.cl-review-thumb\{[^}]*object-fit:contain/);
  assert.doesNotMatch(html, /\.cl-photo-preview\{[^}]*object-fit:cover/);
  assert.doesNotMatch(html, /\.cl-review-thumb\{[^}]*object-fit:cover/);
});

test('photo compression — high-quality smoothing is enabled', () => {
  const start = app.indexOf('function clCompressImage');
  const end = app.indexOf('function clStep4Next', start);
  const fn = app.slice(start, end);
  assert.match(fn, /imageSmoothingEnabled = true/);
  assert.match(fn, /imageSmoothingQuality = 'high'/);
});
