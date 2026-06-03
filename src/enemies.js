// ============================================================================
// ENEMIES  —  blocky mobs that spawn, chase you, and can be shot
// ----------------------------------------------------------------------------
// Each enemy is a little group of boxes (body / head / arms). They fall with
// gravity, follow the ground (stepping up one block to climb hills), walk
// toward the player, and bite when they reach you. Shots are tested against
// each enemy's bounding box (see raycastDamage) — a few hits and they die.
//
// Tunables live in ENEMY below so they're easy to adjust.
// ============================================================================

const ENEMY = {
  SPEED: 1.5,           // blocks/sec (well under the player's 5.5 so you can kite)
  HP: 10,               // handgun(3)=4 hits, rifle(6)=2 hits, heavy(12)=1 hit
  WIDTH: 0.7,
  HEIGHT: 1.6,
  GRAVITY: 26,
  ATTACK_RANGE: 1.5,    // how close before it can bite you
  ATTACK_DAMAGE: 5,
  ATTACK_CD: 0.7,       // seconds between bites
  SPAWN_INTERVAL: 7.0,  // seconds between spawns (was 3.0 — slower now)
  MAX: 3,               // never more than this many at once (was 6 — fewer)
  SPAWN_MIN: 18,        // spawn ring radius around the player (was 10 — farther)
  SPAWN_MAX: 32,
  COLOR: 0x9b4dca,      // purple body
  COLOR_HEAD: 0x6f2da8, // darker purple head
};

// Ray vs axis-aligned box. Returns entry distance (>=0) or null if it misses.
// Assumes `dir` is normalised so the returned t is in world units.
function rayAABB(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz) {
  let tmin = 0, tmax = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn[i] || o[i] > mx[i]) return null; // parallel & outside slab
    } else {
      let t1 = (mn[i] - o[i]) / d[i];
      let t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

class Enemy {
  constructor(scene, x, y, z) {
    this.scene = scene;
    this.x = x; this.y = y; this.z = z;   // (x,z) = centre, y = feet
    this.vy = 0;
    this.onGround = false;
    this.hp = ENEMY.HP;
    this.attackTimer = 0;
    this.flash = 0;     // >0 for a moment after being hit
    this.dead = false;

    this.group = new THREE.Group();
    this.mats = [];
    this.group.add(this._box(0.7, 1.0, 0.45, ENEMY.COLOR, 0, 0.55, 0));     // body
    this.group.add(this._box(0.5, 0.5, 0.5, ENEMY.COLOR_HEAD, 0, 1.3, 0));  // head
    this.group.add(this._box(0.15, 0.8, 0.15, ENEMY.COLOR, -0.42, 0.6, 0)); // left arm
    this.group.add(this._box(0.15, 0.8, 0.15, ENEMY.COLOR, 0.42, 0.6, 0));  // right arm
    this.group.position.set(x, y, z);
    scene.add(this.group);
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
    this.flash = 0.12;
    if (this.hp <= 0) this.dead = true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  // Is the enemy's body cell blocked at this position? (1-cell-wide approximation)
  _blocked(world, x, y, z) {
    const fx = Math.floor(x), fz = Math.floor(z), fy = Math.floor(y);
    return world.isSolidAt(fx, fy, fz) || world.isSolidAt(fx, fy + 1, fz);
  }

  _tryMove(world, mx, mz) {
    const nx = this.x + mx, nz = this.z + mz;
    if (!this._blocked(world, nx, this.y, nz)) { this.x = nx; this.z = nz; return; }
    // Blocked: try to climb a single block (so they can follow you up hills).
    if (this.onGround &&
        !this._blocked(world, nx, this.y + 1, nz) &&
        !world.isSolidAt(Math.floor(nx), Math.floor(this.y) + 2, Math.floor(nz))) {
      this.y = Math.floor(this.y) + 1;
      this.x = nx; this.z = nz;
    }
    // else: stuck against a wall on this axis
  }

  update(dt, world, player, field) {
    // --- chase the player horizontally ---
    let dx = player.pos.x - this.x;
    let dz = player.pos.z - this.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz > 0.9) {
      const inv = 1 / horiz;
      const step = ENEMY.SPEED * dt;
      this._tryMove(world, dx * inv * step, 0);
      this._tryMove(world, 0, dz * inv * step);
    }
    if (horiz > 0.0001) this.group.rotation.y = Math.atan2(dx, dz); // face the player

    // --- force field: can't cross into the player's bubble ---
    if (field && field.active) {
      const c = field.keepOut(this.x, this.z);
      if (c) { this.x = c.x; this.z = c.z; }
    }

    // --- gravity + ground ---
    this.vy -= ENEMY.GRAVITY * dt;
    this.y += this.vy * dt;
    const fx = Math.floor(this.x), fz = Math.floor(this.z);
    const feetCell = Math.floor(this.y - 1e-4);
    if (world.isSolidAt(fx, feetCell, fz)) {
      this.y = feetCell + 1; this.vy = 0; this.onGround = true;
    } else {
      this.onGround = false;
    }

    // --- bite the player when in range ---
    this.attackTimer -= dt;
    const vertOverlap = player.pos.y < this.y + ENEMY.HEIGHT && player.pos.y + 1.8 > this.y;
    if (horiz <= ENEMY.ATTACK_RANGE && vertOverlap && this.attackTimer <= 0) {
      player.hurt(ENEMY.ATTACK_DAMAGE);
      this.attackTimer = ENEMY.ATTACK_CD;
    }

    // --- hit flash (red emissive pulse) ---
    if (this.flash > 0) this.flash -= dt;
    const emis = this.flash > 0 ? 0xff5555 : 0x000000;
    for (const m of this.mats) m.emissive.setHex(emis);

    this.group.position.set(this.x, this.y, this.z);
  }
}

class Enemies {
  constructor(scene, world, player, onScore) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.onScore = onScore || function () {};
    this.list = [];
    this.timer = 0;
    this.score = 0;
    this.field = null;  // set by main; when active, enemies can't enter it
    this.onKill = null; // set by main; called (x,y,z) when a mob dies (for drops)
  }

  clear() {
    for (const e of this.list) e.dispose();
    this.list.length = 0;
  }

  spawn() {
    const ang = Math.random() * Math.PI * 2;
    const r = ENEMY.SPAWN_MIN + Math.random() * (ENEMY.SPAWN_MAX - ENEMY.SPAWN_MIN);
    let x = this.player.pos.x + Math.cos(ang) * r;
    let z = this.player.pos.z + Math.sin(ang) * r;
    x = Math.max(1, Math.min(this.world.W - 2, x));
    z = Math.max(1, Math.min(this.world.D - 2, z));
    const h = this.world.heightMap[Math.floor(x) + Math.floor(z) * this.world.W];
    this.list.push(new Enemy(this.scene, x, h + 1, z));
  }

  update(dt) {
    // periodic spawning up to the cap
    this.timer += dt;
    if (this.timer >= ENEMY.SPAWN_INTERVAL && this.list.length < ENEMY.MAX) {
      this.timer = 0;
      this.spawn();
    }
    // update each enemy; drop any that fell out of the world
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.update(dt, this.world, this.player, this.field);
      if (e.y < -10) { e.dispose(); this.list.splice(i, 1); }
    }
  }

  // Called by the gun (weapons.damageHook). Hits the nearest enemy along the ray
  // within maxDist, applies damage, and returns { dist } if something was hit.
  raycastDamage(origin, dir, maxDist, damage) {
    let bestT = maxDist, victim = null;
    const half = ENEMY.WIDTH / 2;
    for (const e of this.list) {
      const t = rayAABB(
        origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
        e.x - half, e.y, e.z - half,
        e.x + half, e.y + ENEMY.HEIGHT, e.z + half
      );
      if (t !== null && t < bestT) { bestT = t; victim = e; }
    }
    if (!victim) return null;

    victim.hurt(damage);
    Audio.enemyHit();
    if (victim.dead) {
      Audio.enemyDie();
      if (this.onKill) this.onKill(victim.x, victim.y, victim.z); // drop loot here
      victim.dispose();
      this.list.splice(this.list.indexOf(victim), 1);
      this.score++;
      this.onScore(this.score);
    }
    return { dist: bestT };
  }
}
