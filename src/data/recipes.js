// ============================================================================
// CRAFTING RECIPES  —  EXACTLY THESE 5  (EASY TO EDIT, but don't add extras)
// ----------------------------------------------------------------------------
// Each recipe has:
//   id     : internal key
//   label  : shown in the inventory screen
//   inputs : [{ id, n }]  block/item ids and how many are consumed
//   output : what crafting produces -
//              { kind:'item',    id, n }     -> adds n of a block/item
//              { kind:'ammo' }                -> refills the current gun's ammo
//              { kind:'upgrade', from, to }   -> swaps the gun tier (from -> to)
//
// Upgrade recipes only work when you currently hold the `from` gun tier, and are
// hidden once you've moved past them. (Handled in crafting.js.)
// ============================================================================

const RECIPES = [
  {
    id: 'planks', label: 'Planks',
    inputs: [{ id: BLOCK.WOOD, n: 1 }],
    output: { kind: 'item', id: BLOCK.PLANKS, n: 4 },
  },
  {
    id: 'craftblock', label: 'Crafting Block',
    inputs: [{ id: BLOCK.PLANKS, n: 4 }],
    output: { kind: 'item', id: BLOCK.CRAFTING, n: 1 },
  },
  {
    id: 'ammo', label: 'Ammo Pack',
    inputs: [{ id: BLOCK.STONE, n: 3 }, { id: BLOCK.WOOD, n: 1 }],
    output: { kind: 'ammo' },
  },
  {
    id: 'upgrade_rifle', label: 'Upgrade: Rifle',
    inputs: [{ id: BLOCK.STONE, n: 8 }, { id: BLOCK.WOOD, n: 3 }],
    output: { kind: 'upgrade', from: GUN_TIER.HANDGUN, to: GUN_TIER.RIFLE },
  },
  {
    id: 'upgrade_heavy', label: 'Upgrade: Heavy Gun',
    inputs: [{ id: BLOCK.STONE, n: 15 }, { id: BLOCK.WOOD, n: 5 }],
    output: { kind: 'upgrade', from: GUN_TIER.RIFLE, to: GUN_TIER.HEAVY },
  },
];
