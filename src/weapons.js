// ============================================================================
// WEAPONS  —  equipping a gun, firing, ammo, and the shooting effects
// ----------------------------------------------------------------------------
// The current gun's viewmodel is parented to the CAMERA, so it stays fixed in
// view like a real first-person weapon. Firing casts a ray from screen-centre,
// spends one ammo, draws a tracer to the impact point, pops a muzzle flash, and
// kicks the gun back a little (recoil). Damage to enemies is added in
// Milestone 4 via the `damageHook` extension point — see fire().
// ============================================================================

function _disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

class Weapons {
  constructor(scene, camera, world, input, onChange) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.onChange = onChange || function () {};

    this.tier = GUN_TIER.HANDGUN;     // you start with the handgun
    this.spec = GUNS[this.tier];
    this.ammo = this.spec.startAmmo;
    this.active = false;              // true only while in gun mode
    this.fieldActive = false;         // true while the force field is up (blocks firing)

    this.viewmodel = null;
    this.flashMesh = null;
    this.flashLight = null;
    this.flashTimer = 0;
    this.recoil = 0;
    this._baseZ = 0;
    this.tracers = [];

    // Milestone 4 sets this to a function(origin, dir, maxDist, damage) that
    // damages the nearest enemy along the ray and returns { dist } if it hit one.
    this.damageHook = null;

    this.equip(this.tier);

    // Left mouse fires — but only while playing AND in gun mode.
    input.dom.addEventListener('mousedown', (e) => {
      if (!input.locked || !this.active || e.button !== 0) return;
      this.fire();
    });
  }

  // Build (or rebuild) the current tier's viewmodel and attach it to the camera.
  equip(tier) {
    this.tier = tier;
    this.spec = GUNS[tier];

    if (this.viewmodel) { this.camera.remove(this.viewmodel); _disposeObject(this.viewmodel); }

    const g = this.spec.build();
    g.position.copy(this.spec.viewPos);
    this._baseZ = g.position.z;
    g.visible = this.active;
    this.camera.add(g);
    this.viewmodel = g;

    // Muzzle flash (additive sprite-ish mesh) + a brief point light, both at
    // the barrel tip so the flash lines up with the tracer's origin.
    const muz = g.userData.muzzle;
    this.flashMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshBasicMaterial({
        color: this.spec.tracer, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.flashMesh.position.copy(muz);
    this.flashMesh.visible = false;
    g.add(this.flashMesh);

    this.flashLight = new THREE.PointLight(this.spec.tracer, 0, 10);
    this.flashLight.position.copy(muz);
    g.add(this.flashLight);
  }

  // Swap to a different tier (crafting upgrades call this in Milestone 5).
  setTier(tier) {
    this.equip(tier);
    this.ammo = this.spec.startAmmo; // a freshly-built gun comes loaded
    this.onChange();
  }

  setActive(v) {
    this.active = v;
    if (this.viewmodel) this.viewmodel.visible = v;
  }

  // Ammo pack (Milestone 5): top the current gun back up to a full magazine.
  refill() {
    this.ammo = this.spec.magazine;
    this.onChange();
  }

  addAmmo(n) {
    this.ammo = Math.min(this.spec.magazine, this.ammo + n);
    this.onChange();
  }

  // Fire one shot. Returns true if a bullet actually went out.
  fire() {
    if (!this.active) return false;
    if (this.fieldActive) return false;   // can't shoot from inside the force field
    if (this.ammo <= 0) { Audio.dryFire(); return false; } // empty: click, no shot
    this.ammo--;
    Audio.shoot(this.tier);

    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const RANGE = 80;

    // How far until the bullet hits a block?
    const blockHit = raycastVoxel(this.world, origin, dir, RANGE);
    let dist = blockHit ? blockHit.dist : RANGE;

    // Enemies (Milestone 4): may report a closer hit and take damage.
    if (this.damageHook) {
      const e = this.damageHook(origin, dir, dist, this.spec.damage);
      if (e && e.dist < dist) dist = e.dist;
    }

    const end = origin.clone().add(dir.multiplyScalar(dist));
    this._spawnTracer(end);
    this._flash();
    this.recoil = 1;
    this.onChange();
    return true;
  }

  _flash() {
    this.flashMesh.visible = true;
    this.flashMesh.rotation.z = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.6;
    this.flashMesh.scale.set(s, s, s);
    this.flashLight.intensity = 12;
    this.flashTimer = 0.05;
  }

  _spawnTracer(end) {
    // Tracer starts at the real muzzle position in the world.
    this.camera.updateMatrixWorld();
    const start = this.viewmodel.localToWorld(this.viewmodel.userData.muzzle.clone());
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: this.spec.tracer, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, age: 0, life: 0.07 });
  }

  update(dt) {
    // Muzzle flash fade.
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) { this.flashMesh.visible = false; this.flashLight.intensity = 0; }
    }
    // Recoil settles back to rest.
    if (this.viewmodel) {
      this.recoil = Math.max(0, this.recoil - dt * 9);
      this.viewmodel.position.z = this._baseZ + this.recoil * 0.06;
      this.viewmodel.rotation.x = this.recoil * 0.14;
    }
    // Tracers fade out then get removed.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.age += dt;
      const k = 1 - tr.age / tr.life;
      if (k <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        tr.line.material.opacity = k;
      }
    }
  }
}
