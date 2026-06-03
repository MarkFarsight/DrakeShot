// ============================================================================
// BLOCK TYPES  —  EASY TO EDIT
// ----------------------------------------------------------------------------
// Add or tweak block types here. Each block needs:
//   name   : label shown in the inventory (later milestones)
//   color  : base RGB colour (hex) used for its faces (procedural, no textures)
//   solid  : true if the player / bullets collide with it
//
// IDs must stay stable once you have save files, because saves store block IDs.
// 0 is always AIR (empty space).
// ============================================================================

const BLOCK = {
  AIR:      0,
  GRASS:    1,
  DIRT:     2,
  STONE:    3,
  WOOD:     4,
  PLANKS:   5, // crafted from wood
  CRAFTING: 6, // crafted from planks (placeable "crafting block")
};

const BLOCK_TYPES = {
  [BLOCK.GRASS]:    { name: 'Grass',  color: 0x5fa83a, solid: true },
  [BLOCK.DIRT]:     { name: 'Dirt',   color: 0x8a5a2b, solid: true },
  [BLOCK.STONE]:    { name: 'Stone',  color: 0x8c8c8c, solid: true },
  [BLOCK.WOOD]:     { name: 'Wood',   color: 0x6e4a25, solid: true },
  [BLOCK.PLANKS]:   { name: 'Planks', color: 0xc7a062, solid: true },
  [BLOCK.CRAFTING]: { name: 'Crafting Block', color: 0xb5743a, solid: true },
};

// Is this block id something you collide with / can't walk through?
function isSolid(id) {
  return id !== BLOCK.AIR && !!(BLOCK_TYPES[id] && BLOCK_TYPES[id].solid);
}

// Base colour for a block id (falls back to magenta so mistakes are obvious).
function blockColor(id) {
  return (BLOCK_TYPES[id] && BLOCK_TYPES[id].color) ?? 0xff00ff;
}
