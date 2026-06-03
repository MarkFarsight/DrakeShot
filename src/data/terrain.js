// ============================================================================
// WORLD / TERRAIN CONFIG  —  EASY TO EDIT
// ----------------------------------------------------------------------------
// Tweak these numbers to reshape the world. Keep SIZE_X * SIZE_Z reasonable
// (64 x 64 runs smoothly). The whole world is one merged mesh ("one chunk").
// ============================================================================

const WORLD = {
  SIZE_X: 64,        // world width  (blocks along X)
  SIZE_Z: 64,        // world depth  (blocks along Z)
  MAX_HEIGHT: 40,    // vertical size of the block array (room for hills + towers)

  BASE_HEIGHT: 8,    // lowest ground level
  HILL_HEIGHT: 12,   // how many blocks the tallest hills rise above BASE_HEIGHT
  NOISE_SCALE: 0.07, // smaller = broader, smoother hills; larger = bumpier

  DIRT_DEPTH: 3,     // grass on top, this many dirt blocks below it, then stone
  TREES: 7,          // little wood pillars scattered about (a wood resource)

  SEED: 1337,        // change for a different world shape
};
