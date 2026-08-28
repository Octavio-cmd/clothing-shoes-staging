import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appJS = readFileSync(join(import.meta.dirname, '../app.js'), 'utf8');
const indexHTML = readFileSync(join(import.meta.dirname, '../index.html'), 'utf8');

test('Staging isolation: No production URLs', async (t) => {
  // Verificar que app.js no tiene URLs de producción
  await t.test('app.js: no savvy-ebay-prices-production', () => {
    assert.doesNotMatch(
      appJS,
      /savvy-ebay-prices-production\.up\.railway\.app/,
      'app.js debe usar SAVVY_API staging, no production'
    );
  });

  await t.test('app.js: no savvy-rembg-production', () => {
    assert.doesNotMatch(
      appJS,
      /savvy-rembg-production\.up\.railway\.app/,
      'app.js no debe contener URLs de rembg production'
    );
  });

  await t.test('app.js: no savvy-config-production', () => {
    assert.doesNotMatch(
      appJS,
      /savvy-config-production\.up\.railway\.app/,
      'Client legacy savvy-config debe estar eliminado'
    );
  });

  await t.test('app.js: SAVVY_API definido como staging', () => {
    assert.match(
      appJS,
      /const\s+SAVVY_API\s*=\s*['"]https:\/\/ample-imagination-clothing-staging\.up\.railway\.app['"];/,
      'SAVVY_API debe estar configurado con staging URL'
    );
  });

  // Verificar que index.html usa savvy-home-staging
  await t.test('index.html: Home link debe apuntar a savvy-home-staging', () => {
    assert.match(
      indexHTML,
      /savvy-home-staging/,
      'Home link debe apuntar a savvy-home-staging'
    );
  });

  await t.test('index.html: No debe quedar savvy-home/ sin -staging', () => {
    const count = (indexHTML.match(/savvy-home\//g) || []).length;
    const countStaging = (indexHTML.match(/savvy-home-staging/g) || []).length;
    assert.equal(count, 0,
      `No debe haber referencias a 'savvy-home/' sin -staging (encontradas ${count})`
    );
    assert.ok(countStaging > 0, 'Debe haber referencias a savvy-home-staging');
  });

  // Verificar que no hay URLs de production en general
  await t.test('app.js: Función clRemoveBackground comentada (no usada)', () => {
    // Si la función existe, debe estar comentada o tener fallback local
    const hasRemoveBackground = /async function clRemoveBackground/.test(appJS);
    if (hasRemoveBackground) {
      // La función existe pero no debe ser llamada activamente
      const hasCall = /clRemoveBackground\(/.test(
        appJS.split('async function clRemoveBackground')[0]
      );
      assert.ok(!hasCall, 'clRemoveBackground debe estar definida pero no llamada');
    }
  });

  await t.test('Tests helper: _measurements.mjs usa staging API', () => {
    const measJS = readFileSync(join(import.meta.dirname, './_measurements.mjs'), 'utf8');
    assert.match(
      measJS,
      /SAVVY_API:\s*['"]https:\/\/ample-imagination-clothing-staging\.up\.railway\.app['"]/,
      '_measurements.mjs debe usar staging SAVVY_API'
    );
    assert.doesNotMatch(
      measJS,
      /savvy-ebay-prices-production/,
      '_measurements.mjs no debe referir production'
    );
  });

  await t.test('Tests helper: _protected-image-upload.mjs usa staging API', () => {
    const protJS = readFileSync(join(import.meta.dirname, './_protected-image-upload.mjs'), 'utf8');
    assert.match(
      protJS,
      /SAVVY_API:\s*['"]https:\/\/ample-imagination-clothing-staging\.up\.railway\.app['"]/,
      '_protected-image-upload.mjs debe usar staging SAVVY_API'
    );
    assert.doesNotMatch(
      protJS,
      /savvy-ebay-prices-production/,
      '_protected-image-upload.mjs no debe referir production'
    );
  });
});
