// ============================================================================
// NON-BLOCK ITEMS  —  EASY TO EDIT
// ----------------------------------------------------------------------------
// Items you carry but don't place as blocks (so their ids live in a separate
// range, 100+, to avoid clashing with block ids 0-6). They stack in the same
// inventory.counts map as blocks.
// ============================================================================

const ITEM = {
  ENERGY_STONE: 100, // dropped by mobs; used to charge the dragon egg
  HEALTH_PACK: 101,  // dropped by a slain dragon; heals on pickup (not stored)
};

const ITEM_TYPES = {
  [ITEM.ENERGY_STONE]: { name: 'Energy Stone', color: 0xb060ff },
  [ITEM.HEALTH_PACK]:  { name: 'Health Pack',  color: 0xff5b6e },
};

const HEALTH_PACK_HEAL = 60; // health restored when you use (press H) a health pack

// Name/colour for any id, whether it's a block or an item.
function itemName(id) {
  if (typeof BLOCK_TYPES !== 'undefined' && BLOCK_TYPES[id]) return BLOCK_TYPES[id].name;
  if (ITEM_TYPES[id]) return ITEM_TYPES[id].name;
  return '???';
}
function itemColor(id) {
  if (typeof BLOCK_TYPES !== 'undefined' && BLOCK_TYPES[id]) return BLOCK_TYPES[id].color;
  if (ITEM_TYPES[id]) return ITEM_TYPES[id].color;
  return 0xffffff;
}
