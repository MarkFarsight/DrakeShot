// ============================================================================
// DRAGON  —  the dragon egg quest + the purple dragon boss
// ----------------------------------------------------------------------------
// Start of game: a DragonEgg sits at the lowest point of the valley with a beam
// of light on it. Place a Crafting Block next to it, then press C while standing
// near it to pour in Energy Stones (dropped by mobs). 10 stones hatches a big
// purple dragon that flies around, perches on mountaintops, and swoops at you
// now and then. It has 720 HP = 60 hits from the Heavy Gun (12 dmg each).
//
// Dragon hit-testing reuses rayAABB() from enemies.js.
// ============================================================================

const DRAGON = {
  HP: 720,            // 60 Heavy-Gun hits (12 dmg) — also 120 rifle / 240 handgun
  SPEED: 9,           // flight speed (blocks/sec)
  FLY_HEIGHT: 20,     // how high above the ground it cruises
  ATTACK_CD: 12,      // seconds between swoop attacks ("once in a while")
  ATTACK_DAMAGE: 14,
  PERCH_TIME: 6,      // seconds spent sitting on a mountaintop
  COLOR: 0x7a2fb0,
  BELLY: 0xa866d8,
};

// ---------------------------------------------------------------------------
// Dragon Egg
// ---------------------------------------------------------------------------
class DragonEgg {
  // Pass (atX, atZ) to place the egg there (e.g. where a dragon fell); otherwise
  // it goes to the lowest point of the valley.
  constructor(scene, world, atX, atZ) {
    this.scene = scene;
    this.world = world;
    this.charge = 0;
    this.maxCharge = 10;
    this.hatched = false;

    let mx, mz;
    if (atX != null && atZ != null) {
      mx = Math.max(3, Math.min(world.W - 4, Math.floor(atX)));
      mz = Math.max(3, Math.min(world.D - 4, Math.floor(atZ)));
    } else {
      // find the lowest column = bottom of the valley
      let minH = Infinity; mx = Math.floor(world.W / 2); mz = Math.floor(world.D / 2);
      for (let x = 3; x < world.W - 3; x++) {
        for (let z = 3; z < world.D - 3; z++) {
          const h = world.heightMap[x + z * world.W];
          if (h < minH) { minH = h; mx = x; mz = z; }
        }
      }
    }
    this.x = mx + 0.5;
    this.z = mz + 0.5;
    this.baseY = world.heightMap[mx + mz * world.W] + 1; // top of the surface block

    // the egg (a squashed sphere)
    this.egg = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 18, 18),
      new THREE.MeshLambertMaterial({ color: 0x3a2050, emissive: 0x6a30b0, emissiveIntensity: 0.3 })
    );
    this.egg.scale.set(1, 1.4, 1);
    this.egg.position.set(this.x, this.baseY + 0.85, this.z);
    this.egg.castShadow = true;
    scene.add(this.egg);

    // beam of light: translucent cone/cylinder + a spotlight from the sky
    const beamH = 34;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 0.5, beamH, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xeaddff, transparent: true, opacity: 0.13,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    this.beam.position.set(this.x, this.baseY + beamH / 2, this.z);
    scene.add(this.beam);

    this.spot = new THREE.SpotLight(0xffffff, 3, 70, Math.PI * 0.10, 0.6, 1.0);
    this.spot.position.set(this.x, this.baseY + 46, this.z);
    this.spot.target.position.set(this.x, this.baseY, this.z);
    scene.add(this.spot);
    scene.add(this.spot.target);

    this.t = 0;
  }

  // A Crafting Block placed within one cell of the egg base = the "altar".
  hasAltar() {
    const bx = Math.floor(this.x), bz = Math.floor(this.z), by = Math.floor(this.baseY);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = -1; dy <= 1; dy++)
          if (this.world.getBlock(bx + dx, by + dy, bz + dz) === BLOCK.CRAFTING) return true;
    return false;
  }

  nearPlayer(player) {
    return Math.hypot(player.pos.x - this.x, player.pos.z - this.z) < 4.5;
  }

  // Pour the player's energy stones into the egg. Returns a status object.
  depositFrom(inventory) {
    if (this.hatched) return { ok: false, reason: 'hatched' };
    if (!this.hasAltar()) return { ok: false, reason: 'altar' };
    const have = inventory.count(ITEM.ENERGY_STONE);
    if (have <= 0) return { ok: false, reason: 'stones' };
    const take = Math.min(have, this.maxCharge - this.charge);
    inventory.remove(ITEM.ENERGY_STONE, take);
    this.charge += take;
    return { ok: true, took: take, charge: this.charge, ready: this.charge >= this.maxCharge };
  }

  update(dt) {
    if (this.hatched) return;
    this.t += dt;
    this.egg.rotation.y += dt * 0.4;
    const c = this.charge / this.maxCharge;
    this.egg.material.emissiveIntensity = 0.25 + 0.5 * c + 0.08 * Math.sin(this.t * (3 + 6 * c));
    this.beam.material.opacity = 0.11 + 0.04 * Math.sin(this.t * 2);
  }

  hatch() {
    if (this.hatched) return;
    this.hatched = true;
    this._removeVisuals();
  }

  // Remove the egg + beam + spotlight from the scene (used by hatch + New World).
  dispose() {
    if (!this.hatched) this._removeVisuals();
  }

  _removeVisuals() {
    this.scene.remove(this.egg); this.egg.geometry.dispose(); this.egg.material.dispose();
    this.scene.remove(this.beam); this.beam.geometry.dispose(); this.beam.material.dispose();
    this.scene.remove(this.spot); this.scene.remove(this.spot.target);
  }
}

// ---------------------------------------------------------------------------
// Dragon
// ---------------------------------------------------------------------------
class Dragon {
  constructor(scene, world, x, y, z) {
    this.scene = scene;
    this.world = world;
    this.x = x; this.y = y; this.z = z;
    this.hp = DRAGON.HP;
    this.maxHp = DRAGON.HP;
    this.dead = false;
    this.mode = 'wander';
    this.modeTime = 4;
    this.attackTimer = DRAGON.ATTACK_CD;
    this.hitCd = 0;
    this.swoopT = 0;
    this.flash = 0;
    this.wingPhase = 0;
    this.target = new THREE.Vector3(x, y, z);

    this.group = new THREE.Group();
    this.mats = [];
    const C = DRAGON.COLOR, B = DRAGON.BELLY, D = 0x4a1d70;
    // body (head end at +Z)
    this.group.add(this._box(1.4, 0.9, 2.6, C, 0, 0, 0));
    this.group.add(this._box(1.0, 0.4, 2.0, B, 0, -0.35, 0));      // belly
    this.group.add(this._box(0.6, 0.6, 1.0, C, 0, 0.3, 1.5));      // neck
    this.group.add(this._box(0.8, 0.7, 1.0, C, 0, 0.5, 2.3));      // head
    this.group.add(this._box(0.5, 0.3, 0.6, D, 0, 0.35, 2.95));    // snout
    this.group.add(this._box(0.12, 0.4, 0.12, D, 0.22, 0.95, 2.2)); // horn L
    this.group.add(this._box(0.12, 0.4, 0.12, D, -0.22, 0.95, 2.2));// horn R
    // tail (tapering toward -Z)
    this.group.add(this._box(0.6, 0.5, 1.0, C, 0, 0, -1.6));
    this.group.add(this._box(0.4, 0.35, 1.0, C, 0, 0, -2.4));
    this.group.add(this._box(0.22, 0.22, 0.9, D, 0, 0, -3.1));
    // wings (pivot groups so they can flap around the shoulder)
    this.wingL = new THREE.Group(); this.wingL.position.set(0.6, 0.35, 0);
    this.wingL.add(this._box(2.4, 0.12, 1.4, C, 1.3, 0, 0));
    this.group.add(this.wingL);
    this.wingR = new THREE.Group(); this.wingR.position.set(-0.6, 0.35, 0);
    this.wingR.add(this._box(2.4, 0.12, 1.4, C, -1.3, 0, 0));
    this.group.add(this.wingR);

    this.group.position.set(x, y, z);
    scene.add(this.group);
    this._pickWander();
  }

  _box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, emissive: 0x000000 })
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    this.mats.push(m.material);
    return m;
  }

  hurt(dmg) {
    this.hp -= dmg;
    this.flash = 0.08;
    if (this.hp <= 0) this.dead = true;
  }

  // Ray vs the dragon's bounding box. Returns entry distance or null.
  rayDist(origin, dir, maxDist) {
    const hw = 2.4, hh = 1.4, hd = 3.4;
    const t = rayAABB(
      origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
      this.x - hw, this.y - hh, this.z - hd,
      this.x + hw, this.y + hh, this.z + hd
    );
    return (t !== null && t <= maxDist) ? t : null;
  }

  _distToTarget() {
    return Math.hypot(this.target.x - this.x, this.target.y - this.y, this.target.z - this.z);
  }

  _pickWander() {
    const w = this.world;
    const x = 4 + Math.random() * (w.W - 8);
    const z = 4 + Math.random() * (w.D - 8);
    const h = w.heightMap[Math.floor(x) + Math.floor(z) * w.W];
    this.target.set(x, h + DRAGON.FLY_HEIGHT + Math.random() * 6, z);
  }

  _pickPerch() {
    const w = this.world;
    const cx = 5 + Math.floor(Math.random() * (w.W - 10));
    const cz = 5 + Math.floor(Math.random() * (w.D - 10));
    let best = -1, hx = cx, hz = cz;
    for (let x = cx - 4; x <= cx + 4; x++) {
      for (let z = cz - 4; z <= cz + 4; z++) {
        if (x < 0 || z < 0 || x >= w.W || z >= w.D) continue;
        const h = w.heightMap[x + z * w.W];
        if (h > best) { best = h; hx = x; hz = z; }
      }
    }
    this.target.set(hx + 0.5, best + 2.2, hz + 0.5); // perch just above the peak
  }

  update(dt, player) {
    if (this.dead) return;

    // wing flap + hit flash
    this.wingPhase += dt * 8;
    const flap = Math.sin(this.wingPhase) * 0.5;
    this.wingL.rotation.z = -(0.15 + flap);
    this.wingR.rotation.z = (0.15 + flap);
    if (this.flash > 0) this.flash -= dt;
    const emis = this.flash > 0 ? 0xff5566 : 0x000000;
    for (const m of this.mats) m.emissive.setHex(emis);

    // --- behaviour ---
    this.attackTimer -= dt;
    this.hitCd -= dt;
    if (this.mode !== 'swoop' && this.attackTimer <= 0) {
      this.mode = 'swoop';
      this.swoopT = 0;
    }

    if (this.mode === 'swoop') {
      this.swoopT += dt;
      this.target.set(player.pos.x, player.pos.y + 1.5, player.pos.z);
      const d = this._distToTarget();
      if (d < 4 && this.hitCd <= 0) { player.hurt(DRAGON.ATTACK_DAMAGE); this.hitCd = 1.0; }
      if (d < 2.5 || this.swoopT > 5) { // attack done -> back to cruising
        this.mode = 'wander'; this.attackTimer = DRAGON.ATTACK_CD; this._pickWander(); this.modeTime = 4 + Math.random() * 4;
      }
    } else if (this.mode === 'wander') {
      this.modeTime -= dt;
      if (this._distToTarget() < 3 || this.modeTime <= 0) {
        if (Math.random() < 0.4) { this.mode = 'perch'; this._pickPerch(); this.modeTime = DRAGON.PERCH_TIME; }
        else { this._pickWander(); this.modeTime = 4 + Math.random() * 4; }
      }
    } else if (this.mode === 'perch') {
      this.modeTime -= dt;
      if (this.modeTime <= 0) { this.mode = 'wander'; this._pickWander(); this.modeTime = 4 + Math.random() * 4; }
    }

    // --- fly toward target ---
    const dx = this.target.x - this.x, dy = this.target.y - this.y, dz = this.target.z - this.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 0.001) {
      const sp = Math.min(DRAGON.SPEED * dt, d);
      this.x += dx / d * sp; this.y += dy / d * sp; this.z += dz / d * sp;
    }
    const horiz = Math.hypot(dx, dz);
    if (horiz > 0.01) this.group.rotation.y = Math.atan2(dx, dz); // head leads (+Z forward)
    this.group.position.set(this.x, this.y, this.z);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
