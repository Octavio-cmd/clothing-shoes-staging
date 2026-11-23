// BETA — refinamiento propio para fondos relativamente uniformes.
// El modelo genera la mascara inicial. Este modulo elimina regiones que se
// parecen al fondo muestreado en el marco de la fotografia y produce metricas
// para impedir que un recorte defectuoso se publique automaticamente.
(function (root) {
  'use strict';

  const clamp = value => Math.max(0, Math.min(255, value));
  const colorDistance = (data, a, b) => {
    const dr = data[a] - data[b];
    const dg = data[a + 1] - data[b + 1];
    const db = data[a + 2] - data[b + 2];
    return Math.sqrt(dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11);
  };

  function borderSeeds(width, height, stride) {
    const seeds = [];
    for (let x = 0; x < width; x += stride) {
      seeds.push(x, (height - 1) * width + x);
    }
    for (let y = stride; y < height - stride; y += stride) {
      seeds.push(y * width, y * width + width - 1);
    }
    return seeds;
  }

  function refine(imageData, alphaInput, options = {}) {
    const {width, height, data} = imageData;
    const alpha = new Uint8ClampedArray(alphaInput);
    const tolerance = options.tolerance || 30;
    const softTolerance = options.softTolerance || 18;
    const stride = Math.max(1, options.seedStride || Math.round(Math.min(width, height) / 80));
    const seen = new Uint8Array(width * height);
    const queue = [];
    const seeds = borderSeeds(width, height, stride);

    // Cada semilla conserva su color de referencia. La propagacion solo sigue
    // cambios graduales, lo que permite recorrer una alfombra con variaciones.
    for (const seed of seeds) {
      if (seen[seed]) continue;
      seen[seed] = 1;
      queue.push([seed, seed]);
    }

    let removed = 0;
    for (let head = 0; head < queue.length; head++) {
      const [index, reference] = queue[head];
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [];
      if (x) neighbors.push(index - 1);
      if (x + 1 < width) neighbors.push(index + 1);
      if (y) neighbors.push(index - width);
      if (y + 1 < height) neighbors.push(index + width);

      const p = index * 4;
      const ref = reference * 4;
      const bgLike = colorDistance(data, p, ref) <= tolerance;
      if (!bgLike) continue;
      if (alpha[index] > 0) {
        const distance = colorDistance(data, p, ref);
        const keep = clamp((distance - softTolerance) * 255 / Math.max(1, tolerance - softTolerance));
        const next = Math.min(alpha[index], keep);
        if (next < alpha[index]) removed++;
        alpha[index] = next;
      }
      for (const neighbor of neighbors) {
        if (seen[neighbor]) continue;
        const np = neighbor * 4;
        // Continuidad local + parecido flexible con la semilla del marco.
        if (colorDistance(data, np, p) <= 16 && colorDistance(data, np, ref) <= tolerance) {
          seen[neighbor] = 1;
          queue.push([neighbor, reference]);
        }
      }
    }

    const opaqueBefore = alphaInput.reduce((n, value) => n + (value >= 128), 0);
    const opaqueAfter = alpha.reduce((n, value) => n + (value >= 128), 0);
    const borderLeak = seeds.reduce((n, index) => n + (alpha[index] >= 32), 0) / Math.max(1, seeds.length);
    const removalRatio = removed / Math.max(1, opaqueBefore);
    const retainedRatio = opaqueAfter / Math.max(1, opaqueBefore);
    const reviewRequired = borderLeak > 0.02 || retainedRatio < 0.35 || removalRatio > 0.28;

    return {
      alpha,
      metrics: {borderLeak, removalRatio, retainedRatio, reviewRequired}
    };
  }

  const api = {refine};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SavvyBackgroundRefiner = api;
})(typeof window !== 'undefined' ? window : globalThis);
