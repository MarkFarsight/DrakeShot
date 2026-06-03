// ============================================================================
// UI / HUD  —  hotbar, health, ammo, score, and the "E" inventory/craft screen.
// ----------------------------------------------------------------------------
// Pure DOM. The game logic lives elsewhere and just calls these update methods
// when something changes (counts, ammo, health, mode, etc.).
// ============================================================================

class Hud {
  constructor(inventory) {
    this.inv = inventory;
    this.hotbarEl = document.getElementById('hud');
    this.slotEls = [];
    this._buildHotbar();
    this._buildHealth();
  }

  // ---- hotbar (bottom-centre) ----------------------------------------------
  _buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.slotEls = [];
    this.inv.hotbar.forEach((slot, i) => {
      const d = document.createElement('div');
      d.className = 'slot';

      const key = document.createElement('div');
      key.className = 'key';
      key.textContent = i + 1;

      const icon = document.createElement('div');
      const count = document.createElement('div');
      count.className = 'count';
      const name = document.createElement('div');
      name.className = 'name';

      if (slot.type === 'gun') {
        d.classList.add('gun-slot');
        icon.className = 'icon gun-icon';
        name.textContent = 'Gun';
      } else {
        const t = BLOCK_TYPES[slot.id];
        icon.className = 'icon swatch';
        icon.style.background = '#' + t.color.toString(16).padStart(6, '0');
        name.textContent = t.name;
      }

      d.appendChild(key);
      d.appendChild(icon);
      d.appendChild(count);
      d.appendChild(name);
      this.hotbarEl.appendChild(d);
      this.slotEls.push({ slot, el: d, count, name });
    });
  }

  updateHotbar(weapons) {
    this.slotEls.forEach((s, i) => {
      if (s.slot.type === 'gun') {
        if (weapons) { s.name.textContent = weapons.spec.name; s.count.textContent = weapons.ammo; }
      } else {
        s.count.textContent = this.inv.count(s.slot.id);
      }
      s.el.classList.toggle('selected', i === this.inv.selectedSlot);
    });
  }

  // ---- health bar (top-left) -----------------------------------------------
  _buildHealth() {
    const el = document.getElementById('health');
    if (!el) return;
    el.innerHTML = '<div class="hp-bar"><div class="hp-fill"></div></div><div class="hp-num"></div>';
    this.healthFill = el.querySelector('.hp-fill');
    this.healthNum = el.querySelector('.hp-num');
  }

  updateHealth(player) {
    if (!this.healthFill) return;
    const pct = Math.max(0, player.health) / player.maxHealth;
    this.healthFill.style.width = (pct * 100) + '%';
    this.healthFill.style.background =
      pct > 0.5 ? '#5fd35f' : (pct > 0.25 ? '#e8c23a' : '#e8503a');
    this.healthNum.textContent = Math.ceil(player.health) + ' / ' + player.maxHealth;
  }

  updateScore(n) {
    const el = document.getElementById('score');
    if (el) el.textContent = 'KILLS  ' + n;
  }

  // ---- weapon panel (bottom-left) + mode pill (top) ------------------------
  updateWeapon(weapons, mode) {
    const el = document.getElementById('weapon');
    if (!el) return;
    const empty = weapons.ammo <= 0;
    el.innerHTML =
      '<div class="gun-name">' + weapons.spec.name + '</div>' +
      '<div class="ammo' + (empty ? ' empty' : '') + '">' +
      weapons.ammo + '<span>/' + weapons.spec.magazine + '</span></div>';
    el.classList.toggle('holstered', mode !== 'gun');
  }

  updateMode(mode) {
    const el = document.getElementById('mode');
    if (!el) return;
    el.innerHTML = mode === 'gun'
      ? '<b>GUN</b> &nbsp;·&nbsp; <kbd>2</kbd>-<kbd>7</kbd> blocks &nbsp;·&nbsp; <kbd>E</kbd> inventory &nbsp;·&nbsp; <kbd>F</kbd> field'
      : '<b>BUILD</b> &nbsp;·&nbsp; <kbd>1</kbd> gun &nbsp;·&nbsp; <kbd>E</kbd> inventory &nbsp;·&nbsp; <kbd>F</kbd> field';
  }

  // Show/hide the "force field active" banner.
  updateField(active) {
    const el = document.getElementById('field');
    if (el) el.style.display = active ? 'block' : 'none';
  }

  // Energy Stones carried (top-right, under the kill counter).
  updateEnergy(n) {
    const el = document.getElementById('energy');
    if (el) el.textContent = 'ENERGY  ' + n;
  }

  // Health Packs carried (top-left, under the health bar). Hidden when you have none.
  updateHealthPacks(n) {
    const el = document.getElementById('packs');
    if (!el) return;
    if (n > 0) { el.textContent = 'HEALTH PACKS  ' + n + '  ·  press H'; el.style.display = 'block'; }
    else el.style.display = 'none';
  }

  // Contextual prompt shown near the dragon egg (pass null to hide).
  updateEggPrompt(text) {
    const el = document.getElementById('eggprompt');
    if (!el) return;
    if (text) { el.textContent = text; el.style.display = 'block'; }
    else el.style.display = 'none';
  }

  // Dragon boss health bar (pass the dragon, or null to hide).
  updateBoss(dragon) {
    const el = document.getElementById('boss');
    if (!el) return;
    if (!dragon || dragon.dead) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const fill = el.querySelector('.boss-fill');
    if (fill) fill.style.width = Math.max(0, (dragon.hp / dragon.maxHp) * 100) + '%';
  }

  // ---- "E" inventory + crafting screen -------------------------------------
  buildInventoryScreen(recipes, onCraft, onClose) {
    this.invRoot = document.getElementById('inventory');
    this.invRoot.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'inv-panel';

    const head = document.createElement('div');
    head.className = 'inv-head';
    const h2 = document.createElement('h2');
    h2.textContent = 'INVENTORY';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'inv-close';
    closeBtn.textContent = 'Close (E)';
    closeBtn.addEventListener('click', onClose);
    head.appendChild(h2);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    // item counts
    const items = document.createElement('div');
    items.className = 'inv-items';
    this.itemEls = {};
    // blocks you carry, plus the Energy Stone + Health Pack materials
    this.inv.displayItems().concat([ITEM.ENERGY_STONE, ITEM.HEALTH_PACK]).forEach((id) => {
      const chip = document.createElement('div');
      chip.className = 'inv-item';
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = '#' + itemColor(id).toString(16).padStart(6, '0');
      const lab = document.createElement('div');
      lab.className = 'lab';
      lab.textContent = itemName(id);
      const cnt = document.createElement('div');
      cnt.className = 'cnt';
      chip.appendChild(sw);
      chip.appendChild(lab);
      chip.appendChild(cnt);
      items.appendChild(chip);
      this.itemEls[id] = cnt;
    });
    panel.appendChild(items);

    const h3 = document.createElement('h3');
    h3.textContent = 'CRAFTING';
    panel.appendChild(h3);

    // recipes
    const rec = document.createElement('div');
    rec.className = 'inv-recipes';
    this.recipeRows = {};
    recipes.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'recipe';

      const info = document.createElement('div');
      info.className = 'r-info';
      const title = document.createElement('div');
      title.className = 'r-title';
      title.textContent = r.label;
      const need = document.createElement('div');
      need.className = 'r-need';
      need.innerHTML = this._ingredientText(r);
      info.appendChild(title);
      info.appendChild(need);

      const btn = document.createElement('button');
      btn.className = 'r-btn';
      btn.textContent = 'Craft';
      btn.addEventListener('click', () => onCraft(r.id));

      row.appendChild(info);
      row.appendChild(btn);
      rec.appendChild(row);
      this.recipeRows[r.id] = { row, btn };
    });
    panel.appendChild(rec);

    const hint = document.createElement('div');
    hint.className = 'inv-hint';
    hint.textContent = 'Break blocks (build mode) to gather Wood & Stone, then craft here.';
    panel.appendChild(hint);

    this.invRoot.appendChild(panel);
  }

  _ingredientText(r) {
    const ins = r.inputs.map((i) => i.n + '× ' + BLOCK_TYPES[i.id].name).join(' + ');
    let out;
    if (r.output.kind === 'item') out = r.output.n + '× ' + BLOCK_TYPES[r.output.id].name;
    else if (r.output.kind === 'ammo') out = 'Refill ammo';
    else out = GUNS[r.output.to].name;
    return ins + ' &nbsp;→&nbsp; <b>' + out + '</b>';
  }

  updateInventoryScreen(weapons, crafting, recipes) {
    if (!this.itemEls) return;
    for (const id in this.itemEls) this.itemEls[id].textContent = this.inv.count(id);

    recipes.forEach((r) => {
      const row = this.recipeRows[r.id];
      if (!row) return;
      const visible = crafting.isVisible(r);
      row.row.style.display = visible ? 'flex' : 'none';
      if (!visible) return;

      const locked = crafting.isLocked(r);
      const can = crafting.canCraft(r);
      row.row.classList.toggle('locked', locked);
      row.row.classList.toggle('ready', can);
      row.btn.disabled = !can;
      row.btn.textContent = locked
        ? 'Need ' + GUNS[r.output.from].name
        : 'Craft';
    });
  }

  openInventory() { if (this.invRoot) this.invRoot.style.display = 'flex'; }
  closeInventory() { if (this.invRoot) this.invRoot.style.display = 'none'; }
}
