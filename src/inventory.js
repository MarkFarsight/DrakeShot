// ============================================================================
// INVENTORY  —  what you're carrying + the hotbar
// ----------------------------------------------------------------------------
// `counts`  : how many of each block/item id you hold (blocks you break stack here).
// `hotbar`  : the row of slots along the bottom. Slot 0 is always the GUN; the
//             rest are placeable blocks. The number keys 1-9 (and the mouse
//             wheel) pick a slot; the selected slot decides what you do:
//               gun slot  -> gun mode (left-click fires)
//               block slot-> build mode (left-click breaks, right-click places)
// ============================================================================

class Inventory {
  constructor() {
    this.counts = Object.create(null); // id -> how many you hold

    // Slot 0 = gun, then one slot per placeable block type.
    this.hotbar = [
      { type: 'gun' },
      { type: 'block', id: BLOCK.GRASS },
      { type: 'block', id: BLOCK.DIRT },
      { type: 'block', id: BLOCK.STONE },
      { type: 'block', id: BLOCK.WOOD },
      { type: 'block', id: BLOCK.PLANKS },
      { type: 'block', id: BLOCK.CRAFTING },
    ];
    this.selectedSlot = 0; // start holding the gun
  }

  count(id) { return this.counts[id] || 0; }
  add(id, n = 1) { this.counts[id] = this.count(id) + n; }
  remove(id, n = 1) {
    const have = this.count(id);
    this.counts[id] = Math.max(0, have - n);
    return have > 0;
  }

  selectedSlotObj() { return this.hotbar[this.selectedSlot]; }
  isGunSelected() { const s = this.selectedSlotObj(); return !!s && s.type === 'gun'; }

  // The block id in the selected slot, or null if the gun slot is selected.
  selectedBlockId() {
    const s = this.selectedSlotObj();
    return s && s.type === 'block' ? s.id : null;
  }

  // The block ids shown in the larger inventory screen (everything placeable).
  displayItems() {
    return this.hotbar.filter((s) => s.type === 'block').map((s) => s.id);
  }
}
