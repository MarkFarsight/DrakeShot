// ============================================================================
// CRAFTING  —  turns inventory items into planks / crafting blocks / ammo / gun
// upgrades, following the recipes in data/recipes.js.
// ----------------------------------------------------------------------------
// Visibility rules for the UI:
//   isVisible : show the recipe at all? (upgrades hide once you've passed them)
//   isLocked  : show it greyed out because you don't yet own the prerequisite gun
//   canCraft  : do you have the ingredients (and the right gun, for upgrades)?
// ============================================================================

class Crafting {
  constructor(inventory, weapons, onChange) {
    this.inv = inventory;
    this.weapons = weapons;
    this.onChange = onChange || function () {};
  }

  hasInputs(r) {
    return r.inputs.every((i) => this.inv.count(i.id) >= i.n);
  }

  // Upgrade recipes disappear once you've already upgraded past them.
  isVisible(r) {
    if (r.output.kind === 'upgrade') return this.weapons.tier <= r.output.from;
    return true;
  }

  // Greyed out: it's an upgrade but you don't currently hold the required tier.
  isLocked(r) {
    return r.output.kind === 'upgrade' && this.weapons.tier !== r.output.from;
  }

  canCraft(r) {
    if (this.isLocked(r)) return false;
    return this.hasInputs(r);
  }

  craft(r) {
    if (!r || !this.canCraft(r)) return false;

    for (const i of r.inputs) this.inv.remove(i.id, i.n);

    const o = r.output;
    if (o.kind === 'item') this.inv.add(o.id, o.n);
    else if (o.kind === 'ammo') this.weapons.refill();
    else if (o.kind === 'upgrade') this.weapons.setTier(o.to); // swaps viewmodel + stats + full ammo

    Audio.craft();
    this.onChange();
    return true;
  }
}
