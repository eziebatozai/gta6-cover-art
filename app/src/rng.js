// Seeded randomness: every stochastic choice in the poster (panel shuffle, grade jitter, label
// times, art-panel scenery) comes from a mulberry32 stream seeded by the cover's seed, so a
// ?seed= screenshot is byte-stable across runs. The app never touches Math.random.

/** Creates a deterministic [0,1) generator for a 32-bit seed. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A readable 32-bit seed derived from a string, for shot-mode seeds like "vice-night". */
export function seedFromString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates shuffle driven by an rng function; returns a new array. */
export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One seeded float in [lo, hi). */
export function between(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** One seeded integer in [lo, hi]. */
export function intBetween(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}
