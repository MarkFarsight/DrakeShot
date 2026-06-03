// ============================================================================
// Tiny self-contained noise + PRNG helpers (no external dependencies).
// Used to shape the terrain. You normally won't need to edit this.
// ============================================================================

// mulberry32: a small, fast, seedable pseudo-random generator -> returns 0..1.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise in the range 0..1 with smooth interpolation between grid points.
function makeValueNoise(seed) {
  function hash(x, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 362437);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296; // 0..1
  }
  const smooth = (t) => t * t * (3 - 2 * t);      // smoothstep
  const lerp = (a, b, t) => a + (b - a) * t;

  return function (x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const tx = smooth(x - x0), tz = smooth(z - z0);
    const a = hash(x0, z0),     b = hash(x0 + 1, z0);
    const c = hash(x0, z0 + 1), d = hash(x0 + 1, z0 + 1);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  };
}
