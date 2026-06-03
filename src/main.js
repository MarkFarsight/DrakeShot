// ============================================================================
// MAIN  —  boots the game: renderer, scene, sky, lights, world, player, loop
// ----------------------------------------------------------------------------
// Milestone 1 scope: a voxel world you can walk around in.
// Later milestones will add: block breaking/placing, guns, enemies, inventory,
// crafting and saving — each wired in here as its own module.
// ============================================================================


// --- renderer ---------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- scene + sky ------------------------------------------------------------
const scene = new THREE.Scene();
const SKY = 0x87b8e8;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 55, 110); // haze hides the world edge softly

// --- camera -----------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);

// --- lights -----------------------------------------------------------------
// Hemisphere = soft sky/ground ambient so nothing is pure black.
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x556b2f, 0.9));

// Sun = directional light that casts the shadows.
const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
sun.position.set(40, 80, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const SHADOW_AREA = 70; // shadow camera must cover the whole 64x64 world
sun.shadow.camera.left = -SHADOW_AREA;
sun.shadow.camera.right = SHADOW_AREA;
sun.shadow.camera.top = SHADOW_AREA;
sun.shadow.camera.bottom = -SHADOW_AREA;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 240;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

// --- world + player + input -------------------------------------------------
const world = new World(scene);
const player = new Player(world, camera);
const input = new Input(canvas);

// --- inventory + HUD + block interaction (break / place) --------------------
const inventory = new Inventory();
const hud = new Hud(inventory);
// onChange refreshes the HUD whenever counts or the selected block change.
const interaction = new Interaction(scene, world, camera, player, inventory, input, () => refreshAll());

// --- weapons --------------------------------------------------------------
// The gun viewmodel is parented to the camera, so add the camera to the scene
// graph or its children won't be drawn.
scene.add(camera);

// 'gun' = left-click fires · 'build' = break / place blocks. The active mode is
// derived from which hotbar slot is selected (gun slot vs a block slot).
let mode = 'gun';
let inventoryOpen = false;
const weapons = new Weapons(scene, camera, world, input, () => {
  hud.updateWeapon(weapons, mode);
  hud.updateHotbar(weapons);
});

// --- crafting -------------------------------------------------------------
const crafting = new Crafting(inventory, weapons, () => refreshAll());

// Refresh every HUD element that can change when you craft / select / shoot.
function refreshAll() {
  hud.updateHotbar(weapons);
  hud.updateWeapon(weapons, mode);
  if (inventoryOpen) hud.updateInventoryScreen(weapons, crafting, RECIPES);
}

// Selecting a hotbar slot also sets the mode (gun slot -> gun, block -> build).
function selectSlot(i) {
  if (i < 0 || i >= inventory.hotbar.length) return;
  inventory.selectedSlot = i;
  mode = inventory.isGunSelected() ? 'gun' : 'build';
  weapons.setActive(mode === 'gun');     // show + enable the gun only in gun mode
  interaction.setActive(mode === 'build'); // block targeting only in build mode
  hud.updateMode(mode);
  hud.updateWeapon(weapons, mode);
  hud.updateHotbar(weapons);
}

// --- inventory / crafting screen (open with E) ----------------------------
function openInventory() {
  if (inventoryOpen || dead) return;
  inventoryOpen = true;
  document.exitPointerLock();   // free the cursor so you can click recipe buttons
  hud.openInventory();
  hud.updateInventoryScreen(weapons, crafting, RECIPES);
}
function closeInventory() {
  if (!inventoryOpen) return;
  inventoryOpen = false;
  hud.closeInventory();
  lockPointer();                // back into the game
}
hud.buildInventoryScreen(
  RECIPES,
  (id) => crafting.craft(RECIPES.find((r) => r.id === id)), // craft() then refreshAll()
  closeInventory
);

// E toggles the inventory; Esc closes it. Handled here (not in the locked loop)
// because the cursor is unlocked while the screen is open.
addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    if (inventoryOpen) closeInventory();
    else openInventory();
  } else if (e.code === 'Escape' && inventoryOpen) {
    closeInventory();
  } else if (e.code === 'KeyM') {
    Audio.toggle(); // mute / unmute
  }
});

// Mouse wheel cycles hotbar slots while playing.
canvas.addEventListener('wheel', (e) => {
  if (!input.locked || inventoryOpen) return;
  e.preventDefault();
  const n = inventory.hotbar.length;
  selectSlot((inventory.selectedSlot + (e.deltaY > 0 ? 1 : -1) + n) % n);
}, { passive: false });

selectSlot(0); // start holding the gun

// --- enemies + combat -------------------------------------------------------
const enemies = new Enemies(scene, world, player, (score) => hud.updateScore(score));
// Each gunshot asks the enemy manager to damage the nearest enemy along the ray.
weapons.damageHook = (origin, dir, maxDist, damage) =>
  enemies.raycastDamage(origin, dir, maxDist, damage);

// --- force field (defensive bubble, toggle with F) -------------------------
const forcefield = new ForceField(scene, player);
enemies.field = forcefield; // enemies can't cross it while it's active
function toggleField() {
  const on = forcefield.toggle();
  weapons.fieldActive = on; // can't fire while the bubble is up
  hud.updateField(on);
  if (on) Audio.fieldOn(); else Audio.fieldOff();
}

// --- dragon quest: energy-stone drops, the egg, and the dragon -------------
const pickups = new Pickups(scene, world, player, inventory, () => {
  hud.updateEnergy(inventory.count(ITEM.ENERGY_STONE));
  hud.updateHealthPacks(inventory.count(ITEM.HEALTH_PACK));
});
enemies.onKill = (x, y, z) => pickups.spawn(x, y + 0.5, z, ITEM.ENERGY_STONE); // mobs drop a stone

let egg = new DragonEgg(scene, world);
let dragon = null;

// Gun shots hit the nearest of (enemies, dragon): the dragon only takes the hit
// if no enemy is closer along the ray.
weapons.damageHook = (origin, dir, maxDist, damage) => {
  const dragonDist = (dragon && !dragon.dead) ? dragon.rayDist(origin, dir, maxDist) : null;
  const limit = dragonDist != null ? dragonDist : maxDist;
  const e = enemies.raycastDamage(origin, dir, limit, damage);
  if (e) return e;                                   // an enemy was closer
  if (dragonDist != null) { dragon.hurt(damage); Audio.dragonHit(); return { dist: dragonDist }; }
  return null;
};

function hatchDragon() {
  egg.hatch();
  dragon = new Dragon(scene, world, egg.x, egg.baseY + 14, egg.z);
  Audio.dragonHatch();
}

// H uses a stored health pack (if you have one and aren't already full).
function useHealthPack() {
  if (inventory.count(ITEM.HEALTH_PACK) <= 0 || player.health >= player.maxHealth) return;
  inventory.remove(ITEM.HEALTH_PACK, 1);
  player.health = Math.min(player.maxHealth, player.health + HEALTH_PACK_HEAL);
  Audio.heal();
  hud.updateHealth(player);
  lastHealth = player.health;
  hud.updateHealthPacks(inventory.count(ITEM.HEALTH_PACK));
}

// C near the egg pours your energy stones in; 10 hatches the dragon.
function chargeEgg() {
  if (!egg || egg.hatched || !egg.nearPlayer(player)) return;
  const r = egg.depositFrom(inventory);
  hud.updateEnergy(inventory.count(ITEM.ENERGY_STONE));
  if (r.ok) Audio.charge(egg.charge);
  if (r.ok && r.ready) hatchDragon();
}

// Contextual prompt while standing by the egg.
function updateEggPrompt() {
  if (!egg || egg.hatched || !egg.nearPlayer(player)) { hud.updateEggPrompt(null); return; }
  const meter = ' — ' + egg.charge + '/' + egg.maxCharge;
  if (!egg.hasAltar()) hud.updateEggPrompt('Place a Crafting Block by the egg' + meter);
  else if (inventory.count(ITEM.ENERGY_STONE) <= 0) hud.updateEggPrompt('Bring Energy Stones (kill mobs)' + meter);
  else hud.updateEggPrompt('Press C to charge the Dragon Egg' + meter);
}

const hurtEl = document.getElementById('hurt');
const deathEl = document.getElementById('death');
let dead = false;
let lastHealth = player.health;

hud.updateHealth(player);
hud.updateScore(0);

function onDeath() {
  if (dead) return;
  dead = true;
  deathEl.style.display = 'flex';
}

function respawn() {
  player.resetSpawn();
  enemies.clear();           // wipe the mob, keep your kill score
  weapons.refill();          // come back with a full magazine
  dead = false;
  deathEl.style.display = 'none';
  lastHealth = player.health;
  hud.updateHealth(player);
}

// --- saving / loading -------------------------------------------------------
function saveGame() {
  if (!Save.available) return;
  Save.write({
    v: 1,
    edits: world.edits, // only the blocks you changed (compact)
    player: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch, health: player.health,
    },
    inventory: { counts: inventory.counts, selectedSlot: inventory.selectedSlot },
    weapons: { tier: weapons.tier, ammo: weapons.ammo },
    score: enemies.score,
    egg: { charge: egg.charge, hatched: egg.hatched, x: egg.x, z: egg.z },
    dragon: (dragon && !dragon.dead) ? { hp: dragon.hp } : null,
  });
}

function loadGame() {
  const s = Save.read();
  if (!s) return false;
  try {
    if (s.edits) world.loadEdits(s.edits);
    if (s.player) {
      player.pos.set(s.player.x, s.player.y, s.player.z);
      player.yaw = s.player.yaw || 0;
      player.pitch = s.player.pitch || 0;
      player.health = (typeof s.player.health === 'number') ? s.player.health : player.maxHealth;
      player.vel.set(0, 0, 0);
    }
    if (s.inventory) {
      inventory.counts = Object.assign(Object.create(null), s.inventory.counts || {});
      inventory.selectedSlot = s.inventory.selectedSlot || 0;
    }
    if (s.weapons) {
      weapons.equip(s.weapons.tier | 0); // rebuild the correct viewmodel
      weapons.ammo = (typeof s.weapons.ammo === 'number') ? s.weapons.ammo : weapons.spec.magazine;
    }
    if (typeof s.score === 'number') enemies.score = s.score;
    if (s.egg) {
      // move the egg to where it was saved (it may have moved after a dragon kill)
      if (typeof s.egg.x === 'number' && typeof s.egg.z === 'number') {
        egg.dispose();
        egg = new DragonEgg(scene, world, s.egg.x, s.egg.z);
      }
      egg.charge = s.egg.charge || 0;
      if (s.egg.hatched) egg.hatch();
    }
    if (s.dragon && egg.hatched) {
      dragon = new Dragon(scene, world, egg.x, egg.baseY + 14, egg.z);
      dragon.hp = s.dragon.hp;
    }
    return true;
  } catch (e) {
    console.warn('Drakeshot: load failed, starting fresh.', e);
    return false;
  }
}

function newWorld() {
  Save.clear();
  world.reset();
  player.resetSpawn();
  inventory.counts = Object.create(null);
  inventory.selectedSlot = 0;
  weapons.equip(GUN_TIER.HANDGUN);
  weapons.ammo = GUNS[GUN_TIER.HANDGUN].startAmmo;
  enemies.clear();
  enemies.score = 0;
  pickups.clear();
  if (dragon) { dragon.dispose(); dragon = null; }
  egg.dispose();
  egg = new DragonEgg(scene, world);
  hud.updateEnergy(0);
  hud.updateHealthPacks(0);
  hud.updateBoss(null);
  hud.updateEggPrompt(null);
  dead = false;
  deathEl.style.display = 'none';
  selectSlot(0);
  lastHealth = player.health;
  hud.updateHealth(player);
  hud.updateScore(0);
  refreshAll();
  saveGame();
}

// Load any existing save, then sync the HUD + mode to it.
loadGame();
selectSlot(inventory.selectedSlot);
lastHealth = player.health;
hud.updateHealth(player);
hud.updateScore(enemies.score);
hud.updateEnergy(inventory.count(ITEM.ENERGY_STONE));
hud.updateHealthPacks(inventory.count(ITEM.HEALTH_PACK));
hud.updateBoss(dragon);
refreshAll();

if (!Save.available) {
  const warn = document.getElementById('savewarn');
  if (warn) warn.style.display = 'block';
}

setInterval(saveGame, 3000);                // periodic autosave
addEventListener('beforeunload', saveGame); // save on reload / close

const newWorldBtn = document.getElementById('newworld');
if (newWorldBtn) {
  newWorldBtn.addEventListener('click', (e) => { e.stopPropagation(); newWorld(); });
}

// Keep the sun (and its shadow box) centred on the player as they roam.
function followSun() {
  sun.position.set(player.pos.x + 40, 80, player.pos.z + 20);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
}

// --- "click to play" overlay ------------------------------------------------
// The overlay sits ON TOP of the canvas, so it (not the canvas) receives the
// click. Request pointer lock from here. requestPointerLock can return a promise
// that rejects (e.g. Chrome's short cooldown right after you press Esc) — that's
// harmless, so we swallow it.
const overlay = document.getElementById('overlay');
function lockPointer() {
  Audio.init(); // first user gesture — create/resume the audio context
  const p = canvas.requestPointerLock();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}
overlay.addEventListener('click', lockPointer);

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  // Don't show the "click to play" overlay while the inventory screen is up.
  overlay.style.display = (!locked && !inventoryOpen) ? 'flex' : 'none';
});

// --- resize -----------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  // clamp dt so a background tab (huge delta) can't fling the player through walls
  const dt = Math.min(0.05, clock.getDelta());

  // only simulate while the pointer is locked and not paused in a menu
  if (input.locked && !dead && !inventoryOpen) {
    // number keys 1-9 pick a hotbar slot (slot 1 = gun)
    for (let n = 1; n <= 9; n++) {
      if (input.consumePressed('Digit' + n)) selectSlot(n - 1);
    }
    if (input.consumePressed('KeyF')) toggleField();   // F = force field on/off
    if (input.consumePressed('KeyC')) chargeEgg();     // C = pour energy stones into the egg
    if (input.consumePressed('KeyH')) useHealthPack(); // H = use a stored health pack
    player.update(dt, input);
    enemies.update(dt);   // spawn, chase, and bite
    pickups.update(dt);   // energy-stone drops fall + get collected
    if (!egg.hatched) egg.update(dt);
    if (dragon) {
      dragon.update(dt, player);
      if (dragon.dead) {
        Audio.dragonDie();
        const dxp = dragon.x, dyp = dragon.y, dzp = dragon.z;
        dragon.dispose();
        dragon = null;
        enemies.score += 25;
        hud.updateScore(enemies.score);
        // the slain dragon leaves a fresh egg where it fell...
        egg.dispose();
        egg = new DragonEgg(scene, world, dxp, dzp);
        // ...and a health pack lands a couple of blocks off to the side
        const hpx = Math.max(1, Math.min(world.W - 2, egg.x + 3));
        pickups.spawn(hpx, dyp, egg.z, ITEM.HEALTH_PACK);
        hud.updateEggPrompt(null);
      }
    }
    updateEggPrompt();
    hud.updateBoss(dragon);

    if (player.health !== lastHealth) { hud.updateHealth(player); lastHealth = player.health; }
    if (player.health <= 0) onDeath();
  } else if (input.locked && dead) {
    if (input.consumePressed('KeyR')) respawn();
  }

  // red screen pulse fades out after a bite
  if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - dt * 2.5);
  hurtEl.style.opacity = (player.hurtFlash * 0.55).toFixed(3);

  weapons.update(dt);    // muzzle flash / tracer / recoil animations
  forcefield.update(dt); // follow the player + pulse while active
  interaction.update();  // re-aim the block selection outline (build mode only)
  followSun();
  renderer.render(scene, camera);
}
frame();

// Expose a couple of handles for tinkering from the browser console.
window.GAME = { scene, camera, world, player, renderer, inventory, interaction, weapons, enemies, crafting, forcefield, pickups, get egg() { return egg; }, get dragon() { return dragon; } };
