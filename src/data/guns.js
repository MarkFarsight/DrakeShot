// ============================================================================
// GUN TIERS  —  stats + first-person viewmodels  (EASY TO EDIT)
// ----------------------------------------------------------------------------
// Three weapon tiers. Each entry defines:
//   name      : shown in the HUD
//   damage    : hit points removed per shot (enemies arrive in Milestone 4)
//   magazine  : max ammo this gun holds (also the refill target for ammo packs)
//   startAmmo : how much ammo you have when you first get this gun
//   tracer    : colour of the bullet tracer + muzzle flash
//   viewPos   : where the model sits in front of the camera (x,y,z)
//   build()   : returns a THREE.Group built from boxes/cylinders, barrel facing
//               -Z, with group.userData.muzzle = the barrel-tip point (local).
//
// Models are intentionally low-poly / blocky to match the voxel look. No
// external model files — everything is primitives. Tweak freely.
// ============================================================================

const GUN_TIER = { HANDGUN: 0, RIFLE: 1, HEAVY: 2 };

// --- little builder helpers -------------------------------------------------
function _box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}
// Cylinder lying along the Z axis (barrels). length runs front(-Z)..back(+Z).
function _barrel(radius, length, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12),
    new THREE.MeshLambertMaterial({ color })
  );
  m.rotation.x = Math.PI / 2;
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}

const GUN_METAL = 0x32363c;
const GUN_DARK = 0x191b1f;
const GUN_GRIP = 0x6b4a2b;

// --- TIER 1: Handgun (small, low damage, small magazine) --------------------
function buildHandgun() {
  const g = new THREE.Group();
  g.add(_box(0.13, 0.15, 0.46, GUN_METAL, 0, 0.0, -0.08));   // slide / body
  g.add(_box(0.11, 0.05, 0.30, GUN_DARK, 0, 0.10, -0.10));   // top of slide
  g.add(_box(0.07, 0.07, 0.14, GUN_DARK, 0, 0.02, -0.36));   // muzzle block
  g.add(_box(0.11, 0.22, 0.14, GUN_GRIP, 0, -0.17, 0.06));   // grip
  g.add(_box(0.02, 0.05, 0.03, GUN_DARK, 0, 0.15, -0.22));   // front sight
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.45);
  return g;
}

// --- TIER 2: Rifle (longer, more damage, bigger magazine) -------------------
function buildRifle() {
  const g = new THREE.Group();
  g.add(_box(0.12, 0.13, 0.95, GUN_METAL, 0, 0.0, -0.10));   // receiver / body
  g.add(_barrel(0.032, 0.55, GUN_DARK, 0, 0.02, -0.62));     // long barrel
  g.add(_box(0.10, 0.13, 0.26, GUN_GRIP, 0, -0.01, 0.34));   // stock
  g.add(_box(0.10, 0.18, 0.12, GUN_DARK, 0, -0.15, 0.06));   // grip
  g.add(_box(0.09, 0.24, 0.12, GUN_DARK, 0, -0.20, -0.16));  // magazine
  g.add(_box(0.04, 0.06, 0.34, GUN_DARK, 0, 0.11, -0.05));   // top rail
  g.add(_box(0.03, 0.05, 0.04, GUN_DARK, 0, 0.16, 0.10));    // rear sight
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.90);
  return g;
}

// --- TIER 3: Heavy gun (bulky, highest damage, largest magazine) ------------
function buildHeavy() {
  const g = new THREE.Group();
  g.add(_box(0.20, 0.20, 1.05, GUN_METAL, 0, 0.0, -0.10));   // chunky body
  g.add(_barrel(0.055, 0.65, GUN_DARK, 0, 0.03, -0.70));     // fat barrel
  g.add(_barrel(0.075, 0.10, GUN_DARK, 0, 0.03, -1.02));     // muzzle brake
  g.add(_box(0.13, 0.22, 0.16, GUN_DARK, 0, -0.18, 0.12));   // grip
  // ammo drum (cylinder on its side, facing X)
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16),
    new THREE.MeshLambertMaterial({ color: 0x3a2f17 })
  );
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, -0.16, -0.02);
  g.add(drum);
  g.add(_box(0.22, 0.05, 0.5, GUN_DARK, 0, 0.12, -0.10));    // top vent plate
  g.userData.muzzle = new THREE.Vector3(0, 0.03, -1.08);
  return g;
}

const GUNS = [
  {
    tier: GUN_TIER.HANDGUN, name: 'Handgun',
    damage: 3, magazine: 12, startAmmo: 12,
    tracer: 0xfff2a0, viewPos: new THREE.Vector3(0.28, -0.26, -0.55),
    build: buildHandgun,
  },
  {
    tier: GUN_TIER.RIFLE, name: 'Rifle',
    damage: 6, magazine: 30, startAmmo: 30,
    tracer: 0xffc24d, viewPos: new THREE.Vector3(0.30, -0.28, -0.60),
    build: buildRifle,
  },
  {
    tier: GUN_TIER.HEAVY, name: 'Heavy Gun',
    damage: 12, magazine: 60, startAmmo: 60,
    tracer: 0xff6a4d, viewPos: new THREE.Vector3(0.32, -0.30, -0.66),
    build: buildHeavy,
  },
];
