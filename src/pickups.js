// ============================================================================
// PICKUPS  —  little glowing item drops you collect by walking over them
// ----------------------------------------------------------------------------
// Mobs drop an Energy Stone when killed. The drop falls to the ground, bobs and
// spins, and is sucked into your inventory when you get close.
// ============================================================================

const PICKUP = { COLLECT_RANGE: 1.9, GRAVITY: 18 };

class Pickup {
  constructor(scene, x, y, z, itemId) {
    this.scene = scene;
    this.x = x; this.y = y; this.z = z;
    this.itemId = itemId;
    this.vy = 3;                 // little pop upward on spawn
    this.t = Math.random() * 6.28;
    const color = itemColor(itemId);
    // health packs are little cubes; everything else is a spinning gem
    const geo = (itemId === ITEM.HEALTH_PACK)
      ? new THREE.BoxGeometry(0.34, 0.34, 0.34)
      : new THREE.OctahedronGeometry(0.22, 0);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.8 })
    );
    this.mesh.castShadow = true;
    this.mesh.position.set(x, y, z);
    scene.add(this.mesh);
  }

  update(dt, world) {
    // fall to the ground
    this.vy -= PICKUP.GRAVITY * dt;
    this.y += this.vy * dt;
    const fx = Math.floor(this.x), fz = Math.floor(this.z);
    const feet = Math.floor(this.y - 1e-4);
    if (world.isSolidAt(fx, feet, fz)) { this.y = feet + 1; this.vy = 0; }
    // bob + spin
    this.t += dt;
    this.mesh.position.set(this.x, this.y + 0.35 + Math.sin(this.t * 2) * 0.1, this.z);
    this.mesh.rotation.y += dt * 2.5;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

class Pickups {
  constructor(scene, world, player, inventory, onCollect) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.onCollect = onCollect || function () {};
    this.list = [];
  }

  spawn(x, y, z, itemId) { this.list.push(new Pickup(this.scene, x, y, z, itemId)); }

  clear() { for (const p of this.list) p.dispose(); this.list.length = 0; }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.update(dt, this.world);
      const dx = p.x - this.player.pos.x;
      const dy = p.y - (this.player.pos.y + 0.6);
      const dz = p.z - this.player.pos.z;
      if (Math.hypot(dx, dy, dz) < PICKUP.COLLECT_RANGE) {
        this.inventory.add(p.itemId, 1); // everything stacks into the inventory
        Audio.pickup();
        p.dispose();
        this.list.splice(i, 1);
        this.onCollect(p.itemId);
      }
    }
  }
}
