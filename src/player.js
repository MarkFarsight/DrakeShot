// ============================================================================
// PLAYER  —  first-person movement, gravity, jumping, block collision
// ----------------------------------------------------------------------------
// The player is an axis-aligned box (AABB). Each frame we apply velocity one
// axis at a time and, if the box ends up inside a solid block, snap it back to
// the block face. Resolving axes separately lets you slide along walls and land
// cleanly on the ground instead of sticking.
//
// The camera is positioned at eye height every frame; yaw/pitch come from the
// mouse. Movement directions are derived from yaw so "W" always goes where you
// are looking (horizontally).
// ============================================================================


// --- tunables (blocks, blocks/sec, blocks/sec^2) ---------------------------
const PLAYER_HALF_W = 0.3;   // half width  -> player box is 0.6 wide
const PLAYER_HEIGHT = 1.8;   // full height
const EYE_HEIGHT    = 1.6;   // camera offset above the feet
const MOVE_SPEED    = 5.5;
const JUMP_SPEED    = 8.5;
const GRAVITY       = 26;
const LOOK_SENS     = 0.0022; // mouse sensitivity
const MAX_PITCH     = Math.PI / 2 - 0.05;
const EPS           = 1e-4;

class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;

    // Spawn in the middle of the map, standing on the surface.
    this.pos = new THREE.Vector3(world.W / 2 + 0.5, 0, world.D / 2 + 0.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;

    this.maxHealth = 100;
    this.health = 100;
    this.hurtFlash = 0; // brief red screen pulse right after being bitten

    this.respawnOnSurface();
  }

  // Drop the player onto the surface column at their current x,z.
  respawnOnSurface() {
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    const h = this.world.heightMap[x + z * this.world.W] ?? 8;
    this.pos.y = h + 1;        // feet rest on top of the surface block
    this.vel.set(0, 0, 0);
  }

  // Take damage from an enemy bite (clamped at 0).
  hurt(n) {
    this.health = Math.max(0, this.health - n);
    this.hurtFlash = 1;
    Audio.hurt();
  }

  // Full reset used when respawning after death.
  resetSpawn() {
    this.pos.set(this.world.W / 2 + 0.5, 0, this.world.D / 2 + 0.5);
    this.respawnOnSurface();
    this.health = this.maxHealth;
    this.yaw = 0;
    this.pitch = 0;
    this.hurtFlash = 0;
  }

  update(dt, input) {
    // ---- look (mouse) ----
    const { dx, dy } = input.consumeMouseDelta();
    this.yaw   -= dx * LOOK_SENS;
    this.pitch -= dy * LOOK_SENS;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));

    // ---- desired horizontal movement from yaw ----
    const fwd   = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // WASD or arrow keys both move you.
    const kFwd   = input.isDown('KeyW') || input.isDown('ArrowUp');
    const kBack  = input.isDown('KeyS') || input.isDown('ArrowDown');
    const kRight = input.isDown('KeyD') || input.isDown('ArrowRight');
    const kLeft  = input.isDown('KeyA') || input.isDown('ArrowLeft');
    const f = (kFwd ? 1 : 0) - (kBack ? 1 : 0);
    const s = (kRight ? 1 : 0) - (kLeft ? 1 : 0);
    const dir = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, s);
    if (dir.lengthSq() > 0) dir.normalize();
    this.vel.x = dir.x * MOVE_SPEED;
    this.vel.z = dir.z * MOVE_SPEED;

    // ---- jump + gravity ----
    if (input.isDown('Space') && this.onGround) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;
    // clamp fall speed so you can't tunnel through a block in one frame
    if (this.vel.y < -40) this.vel.y = -40;

    // ---- integrate with per-axis collision ----
    this.onGround = false;
    this._stepX(this.vel.x * dt);
    this._stepZ(this.vel.z * dt);
    this._stepY(this.vel.y * dt);

    // ---- place the camera ----
    this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // Collect every solid block cell the player's box currently overlaps.
  _cells() {
    const p = this.pos, hw = PLAYER_HALF_W;
    const minX = Math.floor(p.x - hw + EPS), maxX = Math.floor(p.x + hw - EPS);
    const minY = Math.floor(p.y + EPS),      maxY = Math.floor(p.y + PLAYER_HEIGHT - EPS);
    const minZ = Math.floor(p.z - hw + EPS), maxZ = Math.floor(p.z + hw - EPS);
    const out = [];
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++)
          if (this.world.isSolidAt(x, y, z)) out.push({ x, y, z });
    return out;
  }

  _stepX(d) {
    this.pos.x += d;
    const c = this._cells();
    if (!c.length) return;
    if (d > 0) { let m = Infinity;  for (const k of c) m = Math.min(m, k.x);     this.pos.x = m - PLAYER_HALF_W - EPS; }
    else       { let m = -Infinity; for (const k of c) m = Math.max(m, k.x + 1); this.pos.x = m + PLAYER_HALF_W + EPS; }
    this.vel.x = 0;
  }

  _stepZ(d) {
    this.pos.z += d;
    const c = this._cells();
    if (!c.length) return;
    if (d > 0) { let m = Infinity;  for (const k of c) m = Math.min(m, k.z);     this.pos.z = m - PLAYER_HALF_W - EPS; }
    else       { let m = -Infinity; for (const k of c) m = Math.max(m, k.z + 1); this.pos.z = m + PLAYER_HALF_W + EPS; }
    this.vel.z = 0;
  }

  _stepY(d) {
    this.pos.y += d;
    const c = this._cells();
    if (!c.length) return;
    if (d < 0) {                              // moving down -> we landed
      let m = -Infinity; for (const k of c) m = Math.max(m, k.y + 1);
      this.pos.y = m;
      this.onGround = true;
    } else {                                  // moving up -> bonked our head
      let m = Infinity; for (const k of c) m = Math.min(m, k.y);
      this.pos.y = m - PLAYER_HEIGHT - EPS;
    }
    this.vel.y = 0;
  }
}
