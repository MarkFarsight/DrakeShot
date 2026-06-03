// ============================================================================
// INTERACTION  —  targeting blocks, the selection outline, breaking & placing
// ----------------------------------------------------------------------------
// We cast a ray from the centre of the screen (where the crosshair is) into the
// voxel grid using a fast grid-walking algorithm (Amanatides & Woo "voxel DDA").
// It returns the first solid block the ray enters AND the face it came in
// through (the normal), which is exactly what we need to place a block against.
// ============================================================================

const REACH = 6; // how many blocks away you can target

// Walk the ray cell-by-cell until we hit a solid block or run out of reach.
// Returns { x, y, z, nx, ny, nz } (block cell + entry-face normal) or null.
function raycastVoxel(world, origin, dir, maxDist) {
  let ix = Math.floor(origin.x), iy = Math.floor(origin.y), iz = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : (dir.x < 0 ? -1 : 0);
  const stepY = dir.y > 0 ? 1 : (dir.y < 0 ? -1 : 0);
  const stepZ = dir.z > 0 ? 1 : (dir.z < 0 ? -1 : 0);

  // How far along the ray (in t) we travel to cross one whole cell per axis.
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

  // Distance along the ray (in t) to the first cell boundary on each axis.
  let tMaxX = stepX !== 0 ? ((ix + (stepX > 0 ? 1 : 0)) - origin.x) / dir.x : Infinity;
  let tMaxY = stepY !== 0 ? ((iy + (stepY > 0 ? 1 : 0)) - origin.y) / dir.y : Infinity;
  let tMaxZ = stepZ !== 0 ? ((iz + (stepZ > 0 ? 1 : 0)) - origin.z) / dir.z : Infinity;

  let nx = 0, ny = 0, nz = 0; // normal of the face we last stepped through
  let t = 0;

  while (t <= maxDist) {
    // A real, in-bounds solid block counts as a hit (ignore the virtual floor).
    if (world.inBounds(ix, iy, iz) && isSolid(world.getBlock(ix, iy, iz))) {
      return { x: ix, y: iy, z: iz, nx, ny, nz, dist: t }; // dist = distance to the entry face
    }
    // Advance to whichever axis boundary is closest.
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      ix += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      iy += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      iz += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

class Interaction {
  constructor(scene, world, camera, player, inventory, input, onChange) {
    this.world = world;
    this.camera = camera;
    this.player = player;
    this.inventory = inventory;
    this.input = input;
    this.onChange = onChange || function () {};
    this.active = true;            // true only in BUILD mode (set by main)
    this.target = null;            // last raycast result (or null)
    this._dir = new THREE.Vector3();

    // The black wireframe box that highlights the block you're looking at.
    // Slightly larger than 1 so its edges sit just outside the block faces.
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
    );
    this.outline.visible = false;
    scene.add(this.outline);

    // Mouse buttons: left = break, right = place (only while playing/locked).
    input.dom.addEventListener('mousedown', (e) => {
      if (!input.locked || !this.active) return;
      if (e.button === 0) this.breakBlock();
      else if (e.button === 2) this.placeBlock();
    });
    // Don't pop the browser context menu on right-click.
    input.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    // (Hotbar slot cycling via the mouse wheel is handled in main.js so it can
    // include the gun slot, not just blocks.)
  }

  // Turn block targeting on (build mode) or off (gun mode).
  setActive(v) {
    this.active = v;
    if (!v) { this.outline.visible = false; this.target = null; }
  }

  // Re-cast the ray every frame and move/show the selection outline.
  update() {
    if (!this.input.locked || !this.active) { this.outline.visible = false; this.target = null; return; }

    // Look direction straight from the camera's orientation (always current).
    this._dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.target = raycastVoxel(this.world, this.camera.position, this._dir, REACH);

    if (this.target) {
      this.outline.visible = true;
      this.outline.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else {
      this.outline.visible = false;
    }
  }

  // Left-click: remove the targeted block and bank it in the inventory.
  breakBlock() {
    const t = this.target;
    if (!t) return;
    const id = this.world.getBlock(t.x, t.y, t.z);
    if (!isSolid(id)) return;
    this.world.editBlock(t.x, t.y, t.z, BLOCK.AIR);
    this.world.rebuild();
    this.inventory.add(id, 1);
    Audio.breakBlock();
    this.onChange();
  }

  // Right-click: place the selected block on the face we're looking at.
  placeBlock() {
    const t = this.target;
    if (!t) return;
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz; // adjacent (empty) cell
    if (!this.world.inBounds(x, y, z)) return;
    if (isSolid(this.world.getBlock(x, y, z))) return;     // already occupied
    const id = this.inventory.selectedBlockId();
    if (id == null) return;                                // gun slot selected
    if (this.inventory.count(id) <= 0) return;             // nothing of that block
    if (this._intersectsPlayer(x, y, z)) return;           // don't seal yourself in
    this.world.editBlock(x, y, z, id);
    this.world.rebuild();
    this.inventory.remove(id, 1);
    Audio.placeBlock();
    this.onChange();
  }

  // Would a block at cell (x,y,z) overlap the player's body box?
  _intersectsPlayer(x, y, z) {
    const p = this.player.pos;
    return (
      p.x - PLAYER_HALF_W < x + 1 && p.x + PLAYER_HALF_W > x &&
      p.y < y + 1 && p.y + PLAYER_HEIGHT > y &&
      p.z - PLAYER_HALF_W < z + 1 && p.z + PLAYER_HALF_W > z
    );
  }
}
