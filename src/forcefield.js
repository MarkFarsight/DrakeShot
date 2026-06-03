// ============================================================================
// FORCE FIELD  —  a toggleable defensive bubble around the player
// ----------------------------------------------------------------------------
// While active: enemies are pushed back to its boundary and can't get inside,
// but you can't fire your gun (you're standing inside it). Toggle with F.
// The dome is centred on the player and follows you around.
// ============================================================================

const FIELD = {
  RADIUS: 6,         // bubble radius in blocks
  COLOR: 0x46b4ff,   // glow colour
};

class ForceField {
  constructor(scene, player) {
    this.player = player;
    this.radius = FIELD.RADIUS;
    this.active = false;
    this.t = 0;

    const geo = new THREE.SphereGeometry(this.radius, 24, 16);
    // soft translucent shell
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: FIELD.COLOR, transparent: true, opacity: 0.12,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // a faint wireframe over it for a "grid" feel
    this.wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: FIELD.COLOR, wireframe: true, transparent: true, opacity: 0.18,
      depthWrite: false,
    }));
    this.mesh.add(this.wire);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  toggle() {
    this.active = !this.active;
    this.mesh.visible = this.active;
    return this.active;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.mesh.position.set(this.player.pos.x, this.player.pos.y + 1.0, this.player.pos.z);
    this.mesh.material.opacity = 0.10 + 0.04 * Math.sin(this.t * 3); // gentle pulse
    this.mesh.rotation.y += dt * 0.3;
  }

  // If point (x,z) is inside the bubble, return it clamped to the boundary;
  // otherwise return null (no change needed). Used to keep enemies out.
  keepOut(x, z) {
    const dx = x - this.player.pos.x;
    const dz = z - this.player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d >= this.radius) return null;
    if (d < 1e-4) return { x: this.player.pos.x + this.radius, z };
    const k = this.radius / d;
    return { x: this.player.pos.x + dx * k, z: this.player.pos.z + dz * k };
  }
}
